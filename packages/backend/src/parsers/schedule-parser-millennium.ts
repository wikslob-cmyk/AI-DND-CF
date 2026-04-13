import type { ParsedScheduleEntry } from "./schedule-types.js";
import { ScheduleParseError } from "./schedule-types.js";
import { toNumber } from "./schedule-parser-utils.js";

const EXCEL_EPOCH = new Date(1899, 11, 30);
const EXCEL_DATE_THRESHOLD = 40000; // Values above this in Lp. column are Excel serial dates

function excelDateToJs(serial: number): Date {
  return new Date(EXCEL_EPOCH.getTime() + serial * 86400000);
}

/**
 * Parse Millennium Leasing format (tabela_rat_*.xlsx)
 *
 * These files have mixed Lp. column: small integers (1,2,3...) for early rows,
 * then Excel serial dates (45996, 46026...) for later rows.
 * We detect the first Excel date, compute the monthly interval,
 * and backfill dates for earlier rows.
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

  // Phase 1: collect raw entries with Lp. values
  interface RawEntry {
    lpValue: number;
    capital: number;
    interest: number;
    total: number;
    isFirstPayment: boolean;
  }

  const rawEntries: RawEntry[] = [];

  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 4) continue;

    const firstCell = String(row[0] ?? "").trim().toLowerCase();

    if (firstCell.includes("pierwsza rata")) {
      const capital = toNumber(row[1]);
      const interest = toNumber(row[2]);
      const total = toNumber(row[3]) || capital + interest;
      if (capital > 0 || total > 0) {
        rawEntries.push({ lpValue: 0, capital, interest, total, isFirstPayment: true });
      }
      continue;
    }

    const lpValue = toNumber(row[0]);
    if (lpValue <= 0) continue;

    const capital = toNumber(row[1]);
    const interest = toNumber(row[2]);
    const total = toNumber(row[3]) || capital + interest;
    if (capital === 0 && total === 0) continue;

    rawEntries.push({ lpValue, capital, interest, total, isFirstPayment: false });
  }

  if (rawEntries.length === 0) return [];

  // Phase 2: find first Excel date in Lp. column to anchor dates
  let anchorDate: Date | null = null;
  let anchorIndex = -1;

  for (let i = 0; i < rawEntries.length; i++) {
    const entry = rawEntries[i]!;
    if (!entry.isFirstPayment && entry.lpValue > EXCEL_DATE_THRESHOLD) {
      anchorDate = excelDateToJs(entry.lpValue);
      anchorIndex = i;
      break;
    }
  }

  // Phase 3: assign dates
  const entries: ParsedScheduleEntry[] = [];

  if (anchorDate && anchorIndex >= 0) {
    // We have an anchor — backfill earlier entries monthly
    for (let i = 0; i < rawEntries.length; i++) {
      const raw = rawEntries[i]!;
      let paymentDate: Date;

      if (raw.lpValue > EXCEL_DATE_THRESHOLD) {
        paymentDate = excelDateToJs(raw.lpValue);
      } else {
        // Backfill: anchorDate minus (anchorIndex - i) months
        const monthsBack = anchorIndex - i;
        paymentDate = new Date(anchorDate);
        paymentDate.setMonth(paymentDate.getMonth() - monthsBack);
      }

      entries.push({
        installmentNumber: i,
        paymentDate,
        capital: raw.capital,
        interest: raw.interest,
        total: raw.total,
      });
    }
  } else {
    // No Excel dates found — fall back to monthly from today minus entry count
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - rawEntries.length, 1);

    for (let i = 0; i < rawEntries.length; i++) {
      const raw = rawEntries[i]!;
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(startDate.getMonth() + i);

      entries.push({
        installmentNumber: i,
        paymentDate,
        capital: raw.capital,
        interest: raw.interest,
        total: raw.total,
      });
    }
  }

  return entries;
}
