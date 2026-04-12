import type { EntityCode, PeriodType } from "../index.js";

export interface InvoiceRow {
  id: number;
  entityCode: EntityCode;
  documentNumber: string;
  documentType: "FS" | "FZ";
  contractorName: string;
  contractorNip: string | null;
  paymentDue: string;
  currency: string;
  grossValue: number;
  remainingAmount: number;
  remainingAmountPln: number;
}

export interface InvoiceGroup {
  contractorNip: string;
  contractorName: string;
  totalRemainingPln: number;
  invoices: InvoiceRow[];
}

export interface InvoicePeriodData {
  period: PeriodType;
  groups: InvoiceGroup[];
  totalPln: number;
}
