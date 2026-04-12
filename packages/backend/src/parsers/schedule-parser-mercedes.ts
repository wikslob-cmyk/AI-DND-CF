import type { ParsedScheduleEntry } from "./schedule-types.js";
import { ScheduleParseError } from "./schedule-types.js";
import { toNumber, parseDate } from "./schedule-parser-utils.js";

/**
 * Parse Mercedes Leasing format (Harmonogram_platnosci-dndgr-mercedes.xlsx)
 * Header: Nr | Data | Razem oplata miesieczna netto | Kapital netto | Odsetki netto | Kapital pozostajacy do zaplaty
 */
export function parseMercedesExcelFormat(
  data: unknown[][],
  filename: string,
): ParsedScheduleEntry[] {
  let headerRow = -1;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const first = String(row[0] ?? "").trim().toLowerCase();
    if (first === "nr") {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) {
    throw new ScheduleParseError(
      'Cannot find header row "Nr" in Mercedes file',
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

    const total = toNumber(row[2]); // Razem oplata miesieczna netto
    const capital = toNumber(row[3]); // Kapital netto
    const interest = toNumber(row[4]); // Odsetki netto

    entries.push({
      installmentNumber,
      paymentDate,
      capital,
      interest,
      total: total || capital + interest,
    });
  }

  return entries;
}
