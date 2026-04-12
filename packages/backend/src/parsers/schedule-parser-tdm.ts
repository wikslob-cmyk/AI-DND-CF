import type { ParsedScheduleEntry } from "./schedule-types.js";
import { ScheduleParseError } from "./schedule-types.js";
import { parseDate } from "./schedule-parser-utils.js";

/**
 * Parse TDM Millennium Leasing format (TDM-leas.xlsx)
 * CSV-like format embedded in Excel cells (single column with comma-separated values)
 */
export function parseTdmFormat(
  data: unknown[][],
  filename: string,
): ParsedScheduleEntry[] {
  // TDM format: each row is a single string with comma-separated values
  // Format: agreement_number,installment_number,pay_date,status,doc_number,guarantee,guarantee_currency,,net_value_with_comma,PLN,capital_with_comma,interest_with_comma,...
  const entries: ParsedScheduleEntry[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;

    const rawLine = String(row[0]);
    if (!rawLine.trim()) continue;

    // Split by comma but handle decimal numbers that use comma
    // The format uses commas both as field delimiters and decimal separators
    // Pattern: 371889,1,2022-10-05,Status,DocNum,0,0,,4672,10,PLN,3127,9,1545,1,...
    const parts = rawLine.split(",");
    if (parts.length < 15) continue;

    const installmentNumber = parseInt(parts[1] ?? "", 10);
    if (isNaN(installmentNumber) || installmentNumber <= 0) continue;

    const paymentDate = parseDate(parts[2] ?? "");
    if (!paymentDate) continue;

    // Net value: parts[8] + "." + parts[9] (e.g., "4672" + "10" = 4672.10)
    // Capital: parts[11] + "." + parts[12]
    // Interest: parts[13] + "." + parts[14]
    const total = parseFloat(`${parts[8] ?? "0"}.${parts[9] ?? "0"}`);
    const capital = parseFloat(`${parts[11] ?? "0"}.${parts[12] ?? "0"}`);
    const interest = parseFloat(`${parts[13] ?? "0"}.${parts[14] ?? "0"}`);

    if (isNaN(total) || isNaN(capital) || isNaN(interest)) continue;

    entries.push({
      installmentNumber,
      paymentDate,
      capital,
      interest,
      total,
    });
  }

  if (entries.length === 0) {
    throw new ScheduleParseError(
      "No valid installment entries found in TDM file",
      filename,
    );
  }

  return entries;
}
