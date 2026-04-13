import { parseSaldeoFile } from "../parsers/saldeo-parser.js";
import {
  fetchNbpRateWithFallback,
  type FallbackRateProvider,
} from "../services/nbp-rates.js";
import type { ParsedInvoice } from "../parsers/types.js";
import type { ImportResult, FileInput, DbAdapter } from "./orchestrator.js";

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
  const importedEntities = [
    ...new Set(allInvoices.map((inv) => inv.entityCode)),
  ];

  try {
    await db.beginTransaction();
    await db.deleteInvoices(importedEntities);
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
    try {
      await db.rollbackTransaction();
    } catch (rollbackErr) {
      const rollbackMsg =
        rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr);
      errors.push(`Rollback failed: ${rollbackMsg}`);
    }
    const message = err instanceof Error ? err.message : String(err);
    try {
      await db.insertImportLog("failed", {
        files: filenames,
        errors: [message],
      });
    } catch (logErr) {
      const logMsg =
        logErr instanceof Error ? logErr.message : String(logErr);
      errors.push(`Failed to log import error: ${logMsg}`);
    }
    return {
      status: "failed",
      importedAt: new Date(),
      details: {
        files: filenames,
        warnings,
        errors: [message, ...errors],
      },
    };
  }
}
