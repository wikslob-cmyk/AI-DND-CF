const SONNET_KEYWORDS = [
  "prognoza",
  "projekcja",
  "cashflow",
  "cash flow",
  "plynnosc",
  "płynność",
  "ryzyko",
  "analiza",
  "porownaj",
  "porównaj",
  "trend",
  "scenariusz",
  "rekomendacja",
  "strategia",
  "optymalizacja",
  "optymalizuj",
] as const;

const SONNET_MODEL = "claude-sonnet-4-20250514";
const HAIKU_MODEL = "claude-haiku-4-20250414";

export function selectModel(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  for (const keyword of SONNET_KEYWORDS) {
    if (lower.includes(keyword)) {
      return SONNET_MODEL;
    }
  }

  return HAIKU_MODEL;
}

export { SONNET_MODEL, HAIKU_MODEL };
