import * as XLSX from "xlsx";
import { isEntityCode, type EntityCode, type InvoiceType } from "@dnd/shared";
import {
  type ParsedInvoice,
  ValidationError,
  SALDEO_REQUIRED_HEADERS,
  SALDEO_HEADER_ROW,
  SALDEO_DATA_START_ROW,
  RECEIVABLE_REGEX,
  PAYABLE_REGEX,
} from "./types.js";
import { normalizeNip } from "./nip-normalizer.js";

const EXCEL_EPOCH = new Date(1899, 11, 30);

function excelDateToJs(serial: number): Date {
  const ms = (serial - 0) * 86400000;
  return new Date(EXCEL_EPOCH.getTime() + ms);
}

function extractEntityCode(filename: string): EntityCode {
  const match = filename.match(/lista-dokumentow-(\w+)\.xlsx$/i);
  if (!match || !match[1]) {
    throw new ValidationError("Cannot extract entity code from filename", {
      file: filename,
    });
  }

  const code = match[1].toLowerCase();
  if (!isEntityCode(code)) {
    throw new ValidationError(`Unknown entity code: ${code}`, {
      file: filename,
    });
  }

  return code;
}

function validateHeaders(
  headers: unknown[],
  filename: string,
): Map<string, number> {
  const headerMap = new Map<string, number>();

  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (typeof header === "string" && header.trim()) {
      headerMap.set(header.trim(), i);
    }
  }

  const missing: string[] = [];
  for (const required of SALDEO_REQUIRED_HEADERS) {
    if (!headerMap.has(required)) {
      missing.push(required);
    }
  }

  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required columns: ${missing.join(", ")}`,
      { file: filename },
    );
  }

  return headerMap;
}

function classifyDocumentType(typ: string): InvoiceType | null {
  if (RECEIVABLE_REGEX.test(typ)) {
    return "FS";
  }
  if (PAYABLE_REGEX.test(typ)) {
    return "FZ";
  }
  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/\s/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

export function parseSaldeoFile(
  buffer: Buffer,
  filename: string,
): ParsedInvoice[] {
  const entityCode = extractEntityCode(filename);

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new ValidationError("Workbook has no sheets", { file: filename });
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new ValidationError("Sheet is empty", { file: filename });
  }

  const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    range: 0,
    defval: "",
  });

  if (data.length <= SALDEO_HEADER_ROW) {
    throw new ValidationError("File has too few rows (no header row found)", {
      file: filename,
    });
  }

  const headers = data[SALDEO_HEADER_ROW] as unknown[];
  const headerMap = validateHeaders(headers, filename);

  const col = (name: string): number => headerMap.get(name) as number;

  const results: ParsedInvoice[] = [];

  for (let i = SALDEO_DATA_START_ROW; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) {
      continue;
    }

    const typ = String(row[col("Typ")] ?? "").trim();
    const documentType = classifyDocumentType(typ);
    if (!documentType) {
      continue;
    }

    const zapłacono = String(row[col("Zapłacono")] ?? "").trim().toUpperCase();
    if (zapłacono === "TAK") {
      continue;
    }

    const remainingAmount = toNumber(row[col("Pozostało do zapłaty")]);

    const terminRaw = row[col("Termin płatności")];
    let paymentDue: Date;
    if (typeof terminRaw === "number") {
      paymentDue = excelDateToJs(terminRaw);
    } else if (typeof terminRaw === "string" && terminRaw.trim()) {
      paymentDue = new Date(terminRaw);
    } else {
      continue;
    }

    if (isNaN(paymentDue.getTime())) {
      continue;
    }

    const documentNumber = String(row[col("Numer dokumentu")] ?? "").trim();
    const contractorName = String(row[col("Kontrahent")] ?? "").trim();
    const contractorNip = normalizeNip(String(row[col("NIP")] ?? ""));
    const currency = String(row[col("Waluta")] ?? "PLN").trim() || "PLN";
    const grossValue = toNumber(row[col("Wartość brutto")]);
    const partialPayments = toNumber(row[col("Suma płatności częściowych")]);

    results.push({
      entityCode,
      documentNumber,
      documentType,
      contractorName,
      contractorNip,
      paymentDue,
      currency,
      grossValue,
      remainingAmount,
      partialPayments,
      grossValuePln: currency === "PLN" ? grossValue : 0,
    });
  }

  return results;
}
