/**
 * Shared utilities for schedule parsers.
 */

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/\s/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

export function parseDate(value: unknown): Date | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Handle "dd-mm-yyyy" format
    const dmyMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmyMatch) {
      return new Date(
        Number(dmyMatch[3]),
        Number(dmyMatch[2]) - 1,
        Number(dmyMatch[1]),
      );
    }
    // ISO format or standard Date parsing
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number") {
    // Excel date serial
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + value * 86400000);
  }
  return null;
}
