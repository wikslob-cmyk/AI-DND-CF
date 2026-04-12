import type { ParsedInvoice } from "../parsers/types.js";
import type { ParsedWarehouse } from "../parsers/warehouse-parser.js";
import type { ParsedSchedule } from "../parsers/schedule-types.js";

export interface ImportResult {
  status: "success" | "failed";
  importedAt: Date;
  details: {
    files: string[];
    invoiceCount?: number;
    warehouseItemCount?: number;
    scheduleCount?: number;
    warnings: string[];
    errors: string[];
    exchangeRates?: Record<string, number>;
  };
}

export interface FileInput {
  filename: string;
  buffer: Buffer;
}

export interface DbAdapter {
  beginTransaction(): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  deleteInvoices(): Promise<void>;
  insertInvoices(invoices: ParsedInvoice[]): Promise<void>;
  deleteWarehouseItems(): Promise<void>;
  insertWarehouseItems(items: ParsedWarehouse["items"]): Promise<void>;
  insertExchangeRate(
    currency: string,
    ratePln: number,
    rateDate: string,
    importId: number,
  ): Promise<void>;
  insertImportLog(
    status: string,
    details: Record<string, unknown>,
  ): Promise<number>;
  deleteScheduleEntries(liabilityId: number): Promise<void>;
  insertScheduleEntries(
    liabilityId: number,
    entries: ParsedSchedule["entries"],
  ): Promise<void>;
  findLiabilityId(
    entityCode: string,
    liabilityName: string,
  ): Promise<number | null>;
}

// Re-export importers for backward compatibility
export { importSaldeoFiles } from "./saldeo-importer.js";
export { importWarehouseFile } from "./warehouse-importer.js";
export { importScheduleFiles } from "./schedule-importer.js";
