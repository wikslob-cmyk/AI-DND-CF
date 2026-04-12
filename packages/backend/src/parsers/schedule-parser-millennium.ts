import type { ParsedScheduleEntry } from "./schedule-types.js";
import { ScheduleParseError } from "./schedule-types.js";
import { toNumber } from "./schedule-parser-utils.js";

/**
 * Compute payment date based on contract start date + installment number.
 * Millennium files don't contain dates per installment, so we derive them.
 */
function computePaymentDate(
  startDate: Date,
  installmentNumber: number,
): Date {
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + installmentNumber);
  return date;
}

/**
 * Try to extract a contract start date from the sheet data.
 * Looks for rows containing date-like patterns before the header row.
 */
function findContractStartDate(
  data: unknown[][],
  headerRow: number,
): Date | null {
  for (let i = 0; i < headerRow; i++) {
    const row = data[i];
    if (!row) continue;
    for (const cell of row) {
      const text = String(cell ?? "").trim();
      // Match patterns like "2022-01-15" or "15-01-2022" or "15.01.2022"
      const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        const d = new Date(
          Number(isoMatch[1]),
          Number(isoMatch[2]) - 1,
          Number(isoMatch[3]),
        );
        if (!isNaN(d.getTime())) return d;
      }
      const dmyMatch = text.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
      if (dmyMatch) {
        const d = new Date(
          Number(dmyMatch[3]),
          Number(dmyMatch[2]) - 1,
          Number(dmyMatch[1]),
        );
        if (!isNaN(d.getTime())) return d;
      }
    }
  }
  return null;
}

/**
 * Parse Millennium Leasing format (tabela_rat_*.xlsx)
 * Headers: Lp. | Stala (kapitalowa) czesc raty | Zmienna (finansowa) czesc raty | Rata netto | ...
 * First row after header is "Pierwsza rata*" (initial payment)
 */
export function parseMillenniumFormat(
  data: unknown[][],
  filename: string,
): ParsedScheduleEntry[] {
  let headerRow = -1;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    const first = String(row[0] ?? "").trim().toLowerCase();
    if (first === "lp." || first === "lp") {
      headerRow = i;
      break;
    }
  }

  if (headerRow === -1) {
    throw new ScheduleParseError(
      'Cannot find header row "Lp." in Millennium file',
      filename,
    );
  }

  const contractStart = findContractStartDate(data, headerRow);
  // If no start date found in file, use a fallback that makes the issue visible
  const startDate = contractStart ?? new Date(2000, 0, 1);

  const entries: ParsedScheduleEntry[] = [];

  // First row might be "Pierwsza rata*" (initial payment) - include it as installment 0
  const firstDataRow = data[headerRow + 1];
  if (firstDataRow) {
    const firstLabel = String(firstDataRow[0] ?? "")
      .trim()
      .toLowerCase();
    if (firstLabel.includes("pierwsza rata")) {
      const capital = toNumber(firstDataRow[1]);
      const interest = toNumber(firstDataRow[2]);
      const total = toNumber(firstDataRow[3]) || capital + interest;
      if (capital > 0 || total > 0) {
        entries.push({
          installmentNumber: 0,
          paymentDate: computePaymentDate(startDate, 0),
          capital,
          interest,
          total,
        });
      }
    }
  }

  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 4) continue;

    const installmentNumber = toNumber(row[0]);
    if (installmentNumber <= 0 || !Number.isInteger(installmentNumber))
      continue;

    const capital = toNumber(row[1]);
    const interest = toNumber(row[2]);
    const total = toNumber(row[3]) || capital + interest;

    entries.push({
      installmentNumber,
      paymentDate: computePaymentDate(startDate, installmentNumber),
      capital,
      interest,
      total,
    });
  }

  return entries;
}
