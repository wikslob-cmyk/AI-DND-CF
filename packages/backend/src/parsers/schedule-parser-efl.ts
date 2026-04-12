import type { ParsedScheduleEntry } from "./schedule-types.js";
import { ScheduleParseError } from "./schedule-types.js";
import { toNumber, parseDate } from "./schedule-parser-utils.js";

/**
 * Parse EFL-format Excel files (harmonogram_splat_EFL_*.xlsx)
 * Headers: Numer raty | Termin platnosci | Kapital (PLN) | Odsetki (PLN) | Razem (PLN) | Saldo
 */
export function parseEflFormat(
  data: unknown[][],
  filename: string,
): ParsedScheduleEntry[] {
  let headerRow = -1;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const first = String(row[0] ?? "").trim().toLowerCase();
    if (first === "numer raty") {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) {
    throw new ScheduleParseError(
      'Cannot find header row "Numer raty" in EFL file',
      filename,
    );
  }

  const entries: ParsedScheduleEntry[] = [];
  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 5) continue;

    const installmentNumber = toNumber(row[0]);
    if (installmentNumber <= 0 || !Number.isInteger(installmentNumber))
      continue;

    const paymentDate = parseDate(row[1]);
    if (!paymentDate) continue;

    entries.push({
      installmentNumber,
      paymentDate,
      capital: toNumber(row[2]),
      interest: toNumber(row[3]),
      total: toNumber(row[4]),
    });
  }

  return entries;
}
