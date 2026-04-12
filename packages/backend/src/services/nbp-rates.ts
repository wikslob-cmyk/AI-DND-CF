const NBP_API_BASE =
  process.env.NBP_API_URL || "https://api.nbp.pl/api/exchangerates/rates/a";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS =
  process.env.NODE_ENV === "test" || process.env.VITEST ? 10 : 2000;

const SUPPORTED_CURRENCIES = new Set(["EUR", "USD", "GBP"]);

export interface NbpRateResult {
  currency: string;
  ratePln: number;
  rateDate: string;
  isFromFallback: boolean;
}

export class NbpApiError extends Error {
  constructor(
    message: string,
    public readonly currency: string,
  ) {
    super(message);
    this.name = "NbpApiError";
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface NbpApiResponse {
  table: string;
  currency: string;
  code: string;
  rates: Array<{
    no: string;
    effectiveDate: string;
    mid: number;
  }>;
}

async function fetchWithRetry(
  url: string,
  retries: number,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    if (attempt < retries) {
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError;
}

export async function fetchNbpRate(currency: string): Promise<NbpRateResult> {
  const upperCurrency = currency.toUpperCase();

  if (upperCurrency === "PLN") {
    return {
      currency: "PLN",
      ratePln: 1.0,
      rateDate: new Date().toISOString().slice(0, 10),
      isFromFallback: false,
    };
  }

  if (!SUPPORTED_CURRENCIES.has(upperCurrency)) {
    throw new NbpApiError(
      `Nieobsługiwana waluta: ${upperCurrency}. Obsługiwane: PLN, ${[...SUPPORTED_CURRENCIES].join(", ")}`,
      upperCurrency,
    );
  }

  const url = `${NBP_API_BASE}/${upperCurrency}/?format=json`;

  const response = await fetchWithRetry(url, MAX_RETRIES - 1);
  const data = (await response.json()) as NbpApiResponse;

  if (!data.rates || data.rates.length === 0) {
    throw new NbpApiError(
      `NBP API returned no rates for ${upperCurrency}`,
      upperCurrency,
    );
  }

  const latestRate = data.rates[data.rates.length - 1];
  if (!latestRate) {
    throw new NbpApiError(
      `NBP API returned empty rate entry for ${upperCurrency}`,
      upperCurrency,
    );
  }

  return {
    currency: upperCurrency,
    ratePln: latestRate.mid,
    rateDate: latestRate.effectiveDate,
    isFromFallback: false,
  };
}

export interface FallbackRateProvider {
  getLastRate(currency: string): Promise<{ ratePln: number; rateDate: string } | null>;
}

export async function fetchNbpRateWithFallback(
  currency: string,
  fallbackProvider: FallbackRateProvider,
): Promise<NbpRateResult & { warning?: string }> {
  const upperCurrency = currency.toUpperCase();

  if (upperCurrency === "PLN") {
    return {
      currency: "PLN",
      ratePln: 1.0,
      rateDate: new Date().toISOString().slice(0, 10),
      isFromFallback: false,
    };
  }

  if (!SUPPORTED_CURRENCIES.has(upperCurrency)) {
    throw new NbpApiError(
      `Nieobsługiwana waluta: ${upperCurrency}. Obsługiwane: PLN, ${[...SUPPORTED_CURRENCIES].join(", ")}`,
      upperCurrency,
    );
  }

  try {
    return await fetchNbpRate(upperCurrency);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn(
      `NBP API fetch failed for ${upperCurrency}: ${errorMessage}. Attempting fallback.`,
    );
    const fallback = await fallbackProvider.getLastRate(upperCurrency);
    if (fallback) {
      return {
        currency: upperCurrency,
        ratePln: fallback.ratePln,
        rateDate: fallback.rateDate,
        isFromFallback: true,
        warning: `NBP API niedostępne. Użyto ostatniego kursu z ${fallback.rateDate}: ${fallback.ratePln} PLN`,
      };
    }

    throw new NbpApiError(
      `NBP API niedostępne i brak ostatniego kursu w bazie dla ${upperCurrency}`,
      upperCurrency,
    );
  }
}
