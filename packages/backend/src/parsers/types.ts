import type { EntityCode, InvoiceType } from "@dnd/shared";

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly details: { field?: string; row?: number; file?: string },
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface ParsedInvoice {
  entityCode: EntityCode;
  documentNumber: string;
  documentType: InvoiceType;
  contractorName: string;
  contractorNip: string;
  paymentDue: Date;
  currency: string;
  grossValue: number;
  remainingAmount: number;
  partialPayments: number;
  grossValuePln: number;
}

export const SALDEO_REQUIRED_HEADERS = [
  "Typ",
  "Numer dokumentu",
  "Kontrahent",
  "NIP",
  "Termin płatności",
  "Waluta",
  "Wartość brutto",
  "Zapłacono",
  "Pozostało do zapłaty",
  "Suma płatności częściowych",
] as const;

export const SALDEO_HEADER_ROW = 2;
export const SALDEO_DATA_START_ROW = 3;

export const RECEIVABLE_REGEX = /^[A-Z]+_FS_$/;
export const PAYABLE_REGEX = /^[A-Z]+_(FZ|PK|TOW)_$/;
