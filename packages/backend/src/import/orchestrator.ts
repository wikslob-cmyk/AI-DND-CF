import { parseSaldeoFile } from "../parsers/saldeo-parser.js";
import { parseWarehouseFile } from "../parsers/warehouse-parser.js";
import { parseScheduleExcel } from "../parsers/schedule-parser-excel.js";
import { parseSchedulePdf } from "../parsers/schedule-parser-pdf.js";
import {
  SCAN_PDF_FILES,
  SCHEDULE_FILE_MAP,
} from "../parsers/schedule-types.js";
import {
  fetchNbpRateWithFallback,
  type FallbackRateProvider,
} from "../services/nbp-rates.js";
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

export async function importSaldeoFiles(
  files: FileInput[],
  db: DbAdapter,
  fallbackRateProvider: FallbackRateProvider,
): Promise<ImportResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const filenames = files.map((f) => f.filename);

  // Phase 1: Parse all files (fail fast)
  const allInvoices: ParsedInvoice[] = [];
  for (const file of files) {
    try {
      const invoices = parseSaldeoFile(file.buffer, file.filename);
      allInvoices.push(...invoices);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      errors.push(`${file.filename}: ${message}`);
    }
  }

  if (errors.length > 0) {
    await db.insertImportLog("failed", {
      files: filenames,
      errors,
    });
    return {
      status: "failed",
      importedAt: new Date(),
      details: {
        files: filenames,
        warnings,
        errors,
      },
    };
  }

  // Phase 2: Fetch exchange rates for non-PLN currencies
  const currencies = new Set(
    allInvoices
      .map((inv) => inv.currency.toUpperCase())
      .filter((c) => c !== "PLN"),
  );

  const exchangeRates: Record<string, number> = {};
  for (const currency of currencies) {
    try {
      const result = await fetchNbpRateWithFallback(
        currency,
        fallbackRateProvider,
      );
      exchangeRates[currency] = result.ratePln;
      if (result.warning) {
        warnings.push(result.warning);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      errors.push(`Exchange rate ${currency}: ${message}`);
    }
  }

  if (errors.length > 0) {
    await db.insertImportLog("failed", { files: filenames, errors });
    return {
      status: "failed",
      importedAt: new Date(),
      details: { files: filenames, warnings, errors },
    };
  }

  // Update grossValuePln for non-PLN invoices
  for (const invoice of allInvoices) {
    if (invoice.currency.toUpperCase() !== "PLN") {
      const rate = exchangeRates[invoice.currency.toUpperCase()];
      if (rate) {
        invoice.grossValuePln = invoice.grossValue * rate;
      }
    }
  }

  // Phase 3: Transactional DB write
  try {
    await db.beginTransaction();
    await db.deleteInvoices();
    await db.insertInvoices(allInvoices);

    const importId = await db.insertImportLog("success", {
      files: filenames,
      invoiceCount: allInvoices.length,
      warnings,
      exchangeRates,
    });

    for (const [currency, ratePln] of Object.entries(exchangeRates)) {
      const rateDate = new Date().toISOString().slice(0, 10);
      await db.insertExchangeRate(currency, ratePln, rateDate, importId);
    }

    await db.commitTransaction();

    return {
      status: "success",
      importedAt: new Date(),
      details: {
        files: filenames,
        invoiceCount: allInvoices.length,
        warnings,
        errors: [],
        exchangeRates,
      },
    };
  } catch (err) {
    await db.rollbackTransaction();
    const message = err instanceof Error ? err.message : String(err);
    await db.insertImportLog("failed", {
      files: filenames,
      errors: [message],
    });
    return {
      status: "failed",
      importedAt: new Date(),
      details: {
        files: filenames,
        warnings,
        errors: [message],
      },
    };
  }
}

export async function importWarehouseFile(
  file: FileInput,
  db: DbAdapter,
): Promise<ImportResult> {
  const warnings: string[] = [];

  try {
    const warehouse = parseWarehouseFile(file.buffer, file.filename);

    await db.beginTransaction();
    await db.deleteWarehouseItems();
    await db.insertWarehouseItems(warehouse.items);

    await db.insertImportLog("success", {
      files: [file.filename],
      warehouseItemCount: warehouse.items.length,
      totalValue: warehouse.totalValue,
      eurRate: warehouse.eurRate,
      warnings,
    });

    await db.commitTransaction();

    return {
      status: "success",
      importedAt: new Date(),
      details: {
        files: [file.filename],
        warehouseItemCount: warehouse.items.length,
        warnings,
        errors: [],
      },
    };
  } catch (err) {
    await db.rollbackTransaction();
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "failed",
      importedAt: new Date(),
      details: {
        files: [file.filename],
        warnings,
        errors: [message],
      },
    };
  }
}

export async function importScheduleFiles(
  files: FileInput[],
  db: DbAdapter,
): Promise<ImportResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const filenames = files.map((f) => f.filename);
  let scheduleCount = 0;

  // Phase 1: Parse all files
  const schedules: Array<{ schedule: ParsedSchedule; mapping: { entityCode: string; liabilityName: string } }> = [];

  for (const file of files) {
    // Skip known scan PDFs
    if (SCAN_PDF_FILES.includes(file.filename)) {
      warnings.push(`${file.filename}: Skan PDF, wymaga ręcznego wpisu`);
      continue;
    }

    const mapping = SCHEDULE_FILE_MAP[file.filename];
    if (!mapping) {
      warnings.push(`${file.filename}: Brak mapowania pliku — pominięto`);
      continue;
    }

    try {
      let schedule: ParsedSchedule;
      if (file.filename.endsWith(".pdf")) {
        schedule = await parseSchedulePdf(file.buffer, file.filename);
      } else {
        schedule = parseScheduleExcel(file.buffer, file.filename);
      }
      schedules.push({ schedule, mapping });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${file.filename}: ${message}`);
    }
  }

  if (errors.length > 0) {
    await db.insertImportLog("failed", { files: filenames, errors, warnings });
    return {
      status: "failed",
      importedAt: new Date(),
      details: { files: filenames, warnings, errors },
    };
  }

  // Phase 2: Transactional write
  try {
    await db.beginTransaction();

    for (const { schedule, mapping } of schedules) {
      const liabilityId = await db.findLiabilityId(
        mapping.entityCode,
        mapping.liabilityName,
      );

      if (!liabilityId) {
        warnings.push(
          `${schedule.sourceFile}: Nie znaleziono zobowiązania "${mapping.liabilityName}" dla ${mapping.entityCode} — pominięto`,
        );
        continue;
      }

      await db.deleteScheduleEntries(liabilityId);
      await db.insertScheduleEntries(liabilityId, schedule.entries);
      scheduleCount += schedule.entries.length;
    }

    await db.insertImportLog("success", {
      files: filenames,
      scheduleCount,
      warnings,
    });

    await db.commitTransaction();

    return {
      status: "success",
      importedAt: new Date(),
      details: {
        files: filenames,
        scheduleCount,
        warnings,
        errors: [],
      },
    };
  } catch (err) {
    await db.rollbackTransaction();
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "failed",
      importedAt: new Date(),
      details: {
        files: filenames,
        warnings,
        errors: [message],
      },
    };
  }
}
