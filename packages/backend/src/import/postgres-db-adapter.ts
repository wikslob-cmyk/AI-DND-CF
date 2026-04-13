import type { Sql } from "postgres";
import type { ParsedInvoice } from "../parsers/types.js";
import type { ParsedWarehouseItem } from "../parsers/warehouse-parser.js";
import type { ParsedScheduleEntry } from "../parsers/schedule-types.js";
import type { FallbackRateProvider } from "../services/nbp-rates.js";
import type { DbAdapter, ImportResult, FileInput } from "./orchestrator.js";
import { parseScheduleExcel } from "../parsers/schedule-parser-excel.js";
import { parseSchedulePdf } from "../parsers/schedule-parser-pdf.js";
import { importSaldeoFiles } from "./saldeo-importer.js";
import { importWarehouseFile } from "./warehouse-importer.js";
import { importScheduleFiles } from "./schedule-importer.js";

function buildAdapter(conn: Sql): DbAdapter {
  // postgres.js transactions are callback-based, so begin/commit/rollback
  // are no-ops here — the real transaction boundary is in the run* functions below.
  return {
    async beginTransaction(): Promise<void> { /* no-op */ },
    async commitTransaction(): Promise<void> { /* no-op */ },
    async rollbackTransaction(): Promise<void> { /* no-op */ },

    async deleteInvoices(entityCodes?: string[]): Promise<void> {
      if (entityCodes && entityCodes.length > 0) {
        await conn`DELETE FROM invoice WHERE entity_code IN ${conn(entityCodes)}`;
      } else {
        await conn`DELETE FROM invoice`;
      }
    },

    async insertInvoices(invoices: ParsedInvoice[]): Promise<void> {
      for (const inv of invoices) {
        await conn`
          INSERT INTO invoice (
            entity_code, document_number, document_type,
            contractor_name, contractor_nip, payment_due,
            currency, gross_value, remaining_amount,
            partial_payments, gross_value_pln
          ) VALUES (
            ${inv.entityCode}, ${inv.documentNumber}, ${inv.documentType},
            ${inv.contractorName}, ${inv.contractorNip},
            ${inv.paymentDue.toISOString().slice(0, 10)},
            ${inv.currency}, ${inv.grossValue}, ${inv.remainingAmount},
            ${inv.partialPayments}, ${inv.grossValuePln}
          )
        `;
      }
    },

    async deleteWarehouseItems(): Promise<void> {
      await conn`DELETE FROM warehouse_item`;
    },

    async insertWarehouseItems(items: ParsedWarehouseItem[]): Promise<void> {
      for (const item of items) {
        await conn`
          INSERT INTO warehouse_item (
            entity_code, article_name, quantity_component,
            quantity_finished, quantity_total, unit_price,
            value_component, value_finished, value_total
          ) VALUES (
            'dngro', ${item.articleName}, ${item.quantityComponent},
            ${item.quantityFinished}, ${item.quantityTotal},
            ${item.unitPrice}, ${item.valueComponent},
            ${item.valueFinished}, ${item.valueTotal}
          )
        `;
      }
    },

    async insertExchangeRate(
      currency: string,
      ratePln: number,
      rateDate: string,
      importId: number,
    ): Promise<void> {
      await conn`
        INSERT INTO exchange_rate (currency, rate_pln, rate_date, import_id)
        VALUES (${currency}, ${ratePln}, ${rateDate}, ${importId})
      `;
    },

    async insertImportLog(
      status: string,
      details: Record<string, unknown>,
    ): Promise<number> {
      const result = await conn`
        INSERT INTO import_log (status, details)
        VALUES (${status}, ${JSON.stringify(details)})
        RETURNING id
      `;
      const row = result[0];
      if (!row) throw new Error("INSERT import_log returned no rows");
      return row.id as number;
    },

    async deleteScheduleEntries(liabilityId: number): Promise<void> {
      await conn`
        DELETE FROM liability_schedule WHERE liability_id = ${liabilityId}
      `;
    },

    async insertScheduleEntries(
      liabilityId: number,
      entries: ParsedScheduleEntry[],
    ): Promise<void> {
      for (const entry of entries) {
        await conn`
          INSERT INTO liability_schedule (
            liability_id, payment_date, capital, interest, total, installment_number
          ) VALUES (
            ${liabilityId},
            ${entry.paymentDate.toISOString().slice(0, 10)},
            ${entry.capital}, ${entry.interest}, ${entry.total},
            ${entry.installmentNumber}
          )
        `;
      }
    },

    async findLiabilityId(
      entityCode: string,
      liabilityName: string,
    ): Promise<number | null> {
      const result = await conn`
        SELECT id FROM liability
        WHERE entity_code = ${entityCode} AND name = ${liabilityName}
        LIMIT 1
      `;
      const row = result[0];
      return row ? (row.id as number) : null;
    },
  };
}

export async function runSaldeoImport(
  sql: Sql,
  files: FileInput[],
  fallbackRateProvider: FallbackRateProvider,
): Promise<ImportResult> {
  return sql.begin(async (tx) => {
    const db = buildAdapter(tx as unknown as Sql);
    return importSaldeoFiles(files, db, fallbackRateProvider);
  });
}

export async function runWarehouseImport(
  sql: Sql,
  file: FileInput,
): Promise<ImportResult> {
  return sql.begin(async (tx) => {
    const db = buildAdapter(tx as unknown as Sql);
    return importWarehouseFile(file, db);
  });
}

export async function runScheduleImport(
  sql: Sql,
  files: FileInput[],
): Promise<ImportResult> {
  return sql.begin(async (tx) => {
    const db = buildAdapter(tx as unknown as Sql);
    return importScheduleFiles(files, db);
  });
}

type ScheduleMapping = Record<
  string,
  | { liabilityId: number }
  | { newLiability: { entityCode: string; name: string; type: string } }
>;

export async function runScheduleImportWithMapping(
  sql: Sql,
  files: FileInput[],
  mapping: ScheduleMapping,
): Promise<ImportResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const filenames = files.map((f) => f.filename);
  let scheduleCount = 0;

  // Phase 1: resolve liability IDs (create new ones if needed)
  const resolvedMapping: Record<string, number> = {};

  for (const file of files) {
    const fileMapping = mapping[file.filename];
    if (!fileMapping) {
      warnings.push(`${file.filename}: Brak przypisania — pominięto`);
      continue;
    }

    if ("liabilityId" in fileMapping) {
      resolvedMapping[file.filename] = fileMapping.liabilityId;
    } else {
      const { entityCode, name, type } = fileMapping.newLiability;
      const result = await sql`
        INSERT INTO liability (entity_code, name, type, status, original_amount, current_balance, source_file, config)
        VALUES (${entityCode}, ${name}, ${type}, 'active', 0, 0, ${file.filename}, '{}')
        RETURNING id
      `;
      const row = result[0];
      if (!row) throw new Error(`INSERT liability returned no rows for ${file.filename}`);
      resolvedMapping[file.filename] = row.id as number;
    }
  }

  // Phase 2: parse files
  const parsed: Array<{
    filename: string;
    liabilityId: number;
    entries: ParsedScheduleEntry[];
  }> = [];

  for (const file of files) {
    const liabilityId = resolvedMapping[file.filename];
    if (!liabilityId) continue;

    try {
      const schedule = file.filename.endsWith(".pdf")
        ? await parseSchedulePdf(file.buffer, file.filename)
        : parseScheduleExcel(file.buffer, file.filename);

      parsed.push({
        filename: file.filename,
        liabilityId,
        entries: schedule.entries,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${file.filename}: ${message}`);
    }
  }

  if (errors.length > 0) {
    return {
      status: "failed",
      importedAt: new Date(),
      details: { files: filenames, warnings, errors },
    };
  }

  // Phase 3: transactional write
  try {
    await sql.begin(async (tx) => {
      for (const { liabilityId, entries } of parsed) {
        await tx`DELETE FROM liability_schedule WHERE liability_id = ${liabilityId}`;

        for (const entry of entries) {
          await tx`
            INSERT INTO liability_schedule (
              liability_id, payment_date, capital, interest, total, installment_number
            ) VALUES (
              ${liabilityId},
              ${entry.paymentDate.toISOString().slice(0, 10)},
              ${entry.capital}, ${entry.interest}, ${entry.total},
              ${entry.installmentNumber}
            )
          `;
        }
        scheduleCount += entries.length;
      }

      await tx`
        INSERT INTO import_log (status, details)
        VALUES ('success', ${JSON.stringify({ files: filenames, scheduleCount, warnings })})
      `;
    });

    return {
      status: "success",
      importedAt: new Date(),
      details: { files: filenames, scheduleCount, warnings, errors: [] },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "failed",
      importedAt: new Date(),
      details: { files: filenames, warnings, errors: [message] },
    };
  }
}

export function createFallbackRateProvider(sql: Sql): FallbackRateProvider {
  return {
    async getLastRate(
      currency: string,
    ): Promise<{ ratePln: number; rateDate: string } | null> {
      const result = await sql`
        SELECT rate_pln, rate_date FROM exchange_rate
        WHERE currency = ${currency}
        ORDER BY rate_date DESC
        LIMIT 1
      `;
      const row = result[0];
      if (!row) return null;
      return {
        ratePln: Number(row.rate_pln),
        rateDate: String(row.rate_date),
      };
    },
  };
}
