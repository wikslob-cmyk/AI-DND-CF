import pdfParse from "pdf-parse";
import type { ParsedSchedule, ParsedScheduleEntry } from "./schedule-types.js";
import { ScheduleParseError, SCAN_PDF_FILES } from "./schedule-types.js";

function parseDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/\s/g, "").replace(",", "."));
}

function parseAliorFormat(text: string): ParsedScheduleEntry[] {
  const entries: ParsedScheduleEntry[] = [];
  const lineRegex =
    /(\d{1,3})\s*(\d{4}-\d{2}-\d{2})\s*([\d\s]+,\d{2})([\d\s]+,\d{2})([\d\s]+,\d{2})([\d\s]+,\d{2})/g;

  let match: RegExpExecArray | null;
  while ((match = lineRegex.exec(text)) !== null) {
    const installmentStr = match[1] ?? "";
    const dateStr = match[2] ?? "";
    const totalStr = match[3] ?? "";
    const capitalStr = match[5] ?? "";
    const interestStr = match[6] ?? "";

    const installmentNumber = parseInt(installmentStr, 10);
    const paymentDate = parseDate(dateStr);
    if (!paymentDate || isNaN(installmentNumber)) continue;

    entries.push({
      installmentNumber,
      paymentDate,
      capital: parseAmount(capitalStr),
      interest: parseAmount(interestStr),
      total: parseAmount(totalStr),
    });
  }

  return entries;
}

function parsePkoFormat(text: string): ParsedScheduleEntry[] {
  const entries: ParsedScheduleEntry[] = [];
  const lineRegex =
    /(\d{1,3})\s*(\d{4}-\d{2}-\d{2})\s*([\d\s]+,\d{2})([\d\s]+,\d{2})([\d\s]+,\d{2})([\d\s]+,\d{2})/g;

  let match: RegExpExecArray | null;
  while ((match = lineRegex.exec(text)) !== null) {
    const installmentStr = match[1] ?? "";
    const dateStr = match[2] ?? "";
    const totalStr = match[3] ?? "";
    const capitalStr = match[4] ?? "";
    const interestStr = match[5] ?? "";

    const installmentNumber = parseInt(installmentStr, 10);
    const paymentDate = parseDate(dateStr);
    if (!paymentDate || isNaN(installmentNumber)) continue;

    entries.push({
      installmentNumber,
      paymentDate,
      capital: parseAmount(capitalStr),
      interest: parseAmount(interestStr),
      total: parseAmount(totalStr),
    });
  }

  return entries;
}

function parseMercedesPdfFormat(text: string): ParsedScheduleEntry[] {
  const entries: ParsedScheduleEntry[] = [];
  const lineRegex =
    /L\d+\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})\s*(\d{4}-\d{2}-\d{2})\s+([\d\s]+,\d{2})\s+(\d{1,3})\s+PLN/g;

  let match: RegExpExecArray | null;
  while ((match = lineRegex.exec(text)) !== null) {
    const capitalStr = match[1] ?? "";
    const interestStr = match[2] ?? "";
    const totalStr = match[3] ?? "";
    const dateStr = match[4] ?? "";
    const installmentStr = match[6] ?? "";

    const installmentNumber = parseInt(installmentStr, 10);
    const paymentDate = parseDate(dateStr);
    if (!paymentDate || installmentNumber <= 0) continue;

    entries.push({
      installmentNumber,
      paymentDate,
      capital: parseAmount(capitalStr),
      interest: parseAmount(interestStr),
      total: parseAmount(totalStr),
    });
  }

  entries.sort((a, b) => a.installmentNumber - b.installmentNumber);
  return entries;
}

type PdfParserFn = (text: string) => ParsedScheduleEntry[];

const PDF_PARSER_MAP: Record<string, PdfParserFn> = {
  "Harmonogram.pdf": parseAliorFormat,
  "Harmonogram spłat_nr umowy 01450_PI_24.pdf": parsePkoFormat,
  "DNDspzoo-leasing.pdf": parseMercedesPdfFormat,
};

export async function parseSchedulePdf(
  buffer: Buffer,
  filename: string,
): Promise<ParsedSchedule> {
  if (SCAN_PDF_FILES.includes(filename)) {
    throw new ScheduleParseError(
      "Skan PDF, wymaga ręcznego wpisu",
      filename,
    );
  }

  const parser = PDF_PARSER_MAP[filename];
  if (!parser) {
    throw new ScheduleParseError(
      `No parser configured for PDF file: ${filename}`,
      filename,
    );
  }

  const pdf = await pdfParse(buffer);

  if (!pdf.text || pdf.text.trim().length < 10) {
    throw new ScheduleParseError(
      "Skan PDF, wymaga ręcznego wpisu",
      filename,
    );
  }

  const entries = parser(pdf.text);

  if (entries.length === 0) {
    throw new ScheduleParseError(
      "No valid installment entries found in PDF",
      filename,
    );
  }

  return { sourceFile: filename, entries };
}
