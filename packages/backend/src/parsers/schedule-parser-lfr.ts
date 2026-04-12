import type { ParsedScheduleEntry } from "./schedule-types.js";
import { ScheduleParseError } from "./schedule-types.js";
import { parseDate } from "./schedule-parser-utils.js";

/**
 * LFR (Łódzki Fundusz Rozwoju) schedule format:
 *
 * Row 10 (0-indexed): headers ["Nr", "Data płatności", "Rata kap. (zł)", "Odsetki kap. (zł)", "Kwota Płatności (zł)", ...]
 * Row 11+: data [installmentNumber, dateSerial, capital, interest, totalPayment, ...]
 *
 * Row 0 with installmentNumber=0 is the disbursement row (skip it).
 * During grace period, capital=0 and totalPayment=0 but interest>0.
 */
export function parseLfrFormat(
  data: unknown[][],
  filename: string,
): ParsedScheduleEntry[] {
  // Find header row containing "Nr" and "Data płatności"
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const joined = row.map(String).join(" ").toLowerCase();
    if (joined.includes("nr") && joined.includes("data")) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new ScheduleParseError(
      "Nie znaleziono wiersza nagłówków w pliku LFR",
      filename,
    );
  }

  const entries: ParsedScheduleEntry[] = [];

  for (let i = headerRowIdx + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 5) continue;

    const installmentNumber = Number(row[0]);
    if (isNaN(installmentNumber) || installmentNumber <= 0) continue;

    const rawDate = row[1];
    const paymentDate = parseDate(rawDate);
    if (!paymentDate || isNaN(paymentDate.getTime())) continue;

    const capital = Math.abs(Number(row[2]) || 0);
    const interest = Math.abs(Number(row[3]) || 0);
    const total = Math.abs(Number(row[4]) || 0);

    // Skip rows where everything is 0
    if (capital === 0 && interest === 0 && total === 0) continue;

    entries.push({
      installmentNumber,
      paymentDate,
      capital,
      interest,
      total: total > 0 ? total : capital + interest,
    });
  }

  return entries;
}
