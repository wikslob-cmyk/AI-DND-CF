import * as XLSX from "xlsx";
import type { ParsedSchedule, ParsedScheduleEntry } from "./schedule-types.js";
import { ScheduleParseError } from "./schedule-types.js";

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/\s/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

function parseDate(value: unknown): Date | null {
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

/**
 * Parse EFL-format Excel files (harmonogram_splat_EFL_*.xlsx)
 * Headers: Numer raty | Termin płatności | Kapitał (PLN) | Odsetki (PLN) | Razem (PLN) | Saldo
 */
function parseEflFormat(
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

/**
 * Parse Millennium Leasing format (tabela_rat_*.xlsx)
 * Headers: Lp. | Stała (kapitałowa) część raty | Zmienna (finansowa) część raty | Rata netto | ...
 * First row after header is "Pierwsza rata*" (initial payment)
 */
function parseMillenniumFormat(
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
          paymentDate: new Date(), // Initial payment date not specified in file
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
      paymentDate: new Date(), // Millennium files don't have dates per installment
      capital,
      interest,
      total,
    });
  }

  return entries;
}

/**
 * Parse Santander Leasing format (harmonogram_santander_*.xlsx)
 * Header search: row with "P." and "DATA WYMAGALNOŚCI"
 */
function parseSantanderFormat(
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

/**
 * Parse Mercedes Leasing format (Harmonogram_platnosci-dndgr-mercedes.xlsx)
 * Header: Nr | Data | Razem opłata miesięczna netto | Kapitał netto | Odsetki netto | Kapitał pozostający do zapłaty
 */
function parseMercedesExcelFormat(
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

    const total = toNumber(row[2]); // Razem opłata miesięczna netto
    const capital = toNumber(row[3]); // Kapitał netto
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

/**
 * Parse TDM Millennium Leasing format (TDM-leas.xlsx)
 * CSV-like format embedded in Excel cells (single column with comma-separated values)
 */
function parseTdmFormat(
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

type ParserFn = (data: unknown[][], filename: string) => ParsedScheduleEntry[];

const PARSER_MAP: Record<string, ParserFn> = {
  "tabela_rat_wynagrodzenia.xlsx": parseMillenniumFormat,
  "tabela_rat_364944.xlsx": parseMillenniumFormat,
  "harmonogram_splat_EFL_6F01694.xlsx": parseEflFormat,
  "harmonogram_splat_EFL6F01696.xlsx": parseEflFormat,
  "harmonogram_splat_EFL6F01695.xlsx": parseEflFormat,
  "harmonogram_santander_NP6_00258_2023.xlsx": parseSantanderFormat,
  "Harmonogram_platnosci-dndgr-mercedes.xlsx": parseMercedesExcelFormat,
  "TDM-leas.xlsx": parseTdmFormat,
};

export function parseScheduleExcel(
  buffer: Buffer,
  filename: string,
): ParsedSchedule {
  const parser = PARSER_MAP[filename];
  if (!parser) {
    throw new ScheduleParseError(
      `No parser configured for Excel file: ${filename}`,
      filename,
    );
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new ScheduleParseError("Workbook has no sheets", filename);
  }

  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new ScheduleParseError("Sheet is empty", filename);
  }

  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    range: 0,
    defval: "",
  });

  const entries = parser(data, filename);

  if (entries.length === 0) {
    throw new ScheduleParseError(
      "No valid installment entries found",
      filename,
    );
  }

  return { sourceFile: filename, entries };
}
