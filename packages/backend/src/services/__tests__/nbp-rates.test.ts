import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchNbpRate,
  fetchNbpRateWithFallback,
  NbpApiError,
  type FallbackRateProvider,
} from "../nbp-rates.js";

describe("fetchNbpRate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns rate 1.0 for PLN", async () => {
    const result = await fetchNbpRate("PLN");

    expect(result.currency).toBe("PLN");
    expect(result.ratePln).toBe(1.0);
    expect(result.isFromFallback).toBe(false);
  });

  it("fetches EUR rate from NBP API", async () => {
    const mockResponse = {
      table: "A",
      currency: "euro",
      code: "EUR",
      rates: [{ no: "072/A/NBP/2026", effectiveDate: "2026-04-12", mid: 4.28 }],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }),
    );

    const result = await fetchNbpRate("EUR");

    expect(result.currency).toBe("EUR");
    expect(result.ratePln).toBe(4.28);
    expect(result.rateDate).toBe("2026-04-12");
    expect(result.isFromFallback).toBe(false);
  });

  it("throws NbpApiError for unsupported currency", async () => {
    await expect(fetchNbpRate("CHF")).rejects.toThrow(NbpApiError);
    await expect(fetchNbpRate("CHF")).rejects.toThrow("Nieobsługiwana waluta: CHF");
  });

  it("retries on failure and returns on success", async () => {
    const mockResponse = {
      table: "A",
      currency: "euro",
      code: "EUR",
      rates: [{ no: "072", effectiveDate: "2026-04-12", mid: 4.28 }],
    };

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchNbpRate("EUR");
    expect(result.ratePln).toBe(4.28);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("fetchNbpRateWithFallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to last rate when API is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    const fallback: FallbackRateProvider = {
      getLastRate: vi.fn().mockResolvedValue({
        ratePln: 4.25,
        rateDate: "2026-04-10",
      }),
    };

    const result = await fetchNbpRateWithFallback("EUR", fallback);

    expect(result.ratePln).toBe(4.25);
    expect(result.isFromFallback).toBe(true);
    expect(result.warning).toContain("NBP API niedostępne");
    expect(result.warning).toContain("4.25");
  });

  it("throws when API is unavailable and no fallback exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    const fallback: FallbackRateProvider = {
      getLastRate: vi.fn().mockResolvedValue(null),
    };

    await expect(
      fetchNbpRateWithFallback("EUR", fallback),
    ).rejects.toThrow(NbpApiError);

    await expect(
      fetchNbpRateWithFallback("EUR", fallback),
    ).rejects.toThrow("brak ostatniego kursu");
  });

  it("throws for unsupported currency even with fallback", async () => {
    const fallback: FallbackRateProvider = {
      getLastRate: vi.fn().mockResolvedValue({ ratePln: 4.5, rateDate: "2026-01-01" }),
    };

    await expect(
      fetchNbpRateWithFallback("CHF", fallback),
    ).rejects.toThrow(NbpApiError);
  });
});
