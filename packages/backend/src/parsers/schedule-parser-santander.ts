import type { ParsedScheduleEntry } from "./schedule-types.js";
import { ScheduleParseError } from "./schedule-types.js";
import { toNumber, parseDate } from "./schedule-parser-utils.js";

/**
 * Parse Santander Leasing format (harmonogram_santander_*.xlsx)
 * Header search: row with "P." and "DATA WYMAGALNOSCI"
 */
export function parseSantanderFormat(
  data: unknown[][],
  filename: string,
): ParsedScheduleEntry[] {
  let headerRow = -1;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const first = String(row[0] ?? "").trim().toUpperCase();
    const second = String(row[1] ?? "").trim().toUpperCase();
    if (
      (first === "P." || first === "P") &&
      second.includes("DATA")
    ) {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) {
    throw new ScheduleParseError(
      "Cannot find header row in Santander file",
      filename,
    );
  }

  const entries: ParsedScheduleEntry[] = [];
  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 6) continue;

    const installmentNumber = toNumber(row[0]);
    if (installmentNumber <= 0 || !Number.isInteger(installmentNumber))
      continue;

    const paymentDate = parseDate(row[1]);
    if (!paymentDate) continue;

    const capitalPart = toNumber(row[2]);
    const interestPart = toNumber(row[3]);
    const totalRaw = toNumber(row[5]); // "RAZEM NETTO PLN"

    entries.push({
      installmentNumber,
      paymentDate,
      capital: capitalPart,
      interest: interestPart,
      total: totalRaw || capitalPart + interestPart,
    });
  }

  return entries;
}
