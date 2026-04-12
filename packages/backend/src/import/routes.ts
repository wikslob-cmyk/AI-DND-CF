import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { MultipartFile, MultipartValue } from "@fastify/multipart";
import { authMiddleware } from "../auth/middleware.js";
import { sql } from "../db/connection.js";
import type { FileInput } from "./orchestrator.js";
import {
  runSaldeoImport,
  runWarehouseImport,
  runScheduleImportWithMapping,
  createFallbackRateProvider,
} from "./postgres-db-adapter.js";

async function parseMultipart(
  request: FastifyRequest,
): Promise<{ files: FileInput[]; fields: Record<string, string> }> {
  const files: FileInput[] = [];
  const fields: Record<string, string> = {};

  const parts = request.parts();
  for await (const part of parts) {
    if (part.type === "file") {
      const filePart = part as MultipartFile;
      const buffer = await filePart.toBuffer();
      files.push({ filename: filePart.filename, buffer });
    } else {
      const fieldPart = part as MultipartValue<string>;
      fields[fieldPart.fieldname] = fieldPart.value;
    }
  }

  return { files, fields };
}

export async function registerImportRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  const fallbackRateProvider = createFallbackRateProvider(sql);

  app.post("/api/import/saldeo", async (request, reply) => {
    const { files } = await parseMultipart(request);

    if (files.length === 0) {
      return reply.status(400).send({
        data: null,
        error: { code: "NO_FILES", message: "Nie przesłano plików" },
      });
    }

    const result = await runSaldeoImport(sql, files, fallbackRateProvider);

    return reply.send({
      data: {
        status: result.status,
        importedAt: result.importedAt.toISOString(),
        details: result.details,
      },
      error: null,
    });
  });

  app.post("/api/import/warehouse", async (request, reply) => {
    const { files } = await parseMultipart(request);

    if (files.length === 0) {
      return reply.status(400).send({
        data: null,
        error: { code: "NO_FILES", message: "Nie przesłano pliku" },
      });
    }

    const result = await runWarehouseImport(sql, files[0]);

    return reply.send({
      data: {
        status: result.status,
        importedAt: result.importedAt.toISOString(),
        details: result.details,
      },
      error: null,
    });
  });

  app.post("/api/import/schedules", async (request, reply) => {
    const { files, fields } = await parseMultipart(request);

    if (files.length === 0) {
      return reply.status(400).send({
        data: null,
        error: { code: "NO_FILES", message: "Nie przesłano plików" },
      });
    }

    let mapping: Record<
      string,
      | { liabilityId: number }
      | { newLiability: { entityCode: string; name: string; type: string } }
    > = {};

    if (fields.mapping) {
      try {
        mapping = JSON.parse(fields.mapping);
      } catch {
        return reply.status(400).send({
          data: null,
          error: {
            code: "INVALID_MAPPING",
            message: "Nieprawidłowy format mapowania",
          },
        });
      }
    }

    const result = await runScheduleImportWithMapping(sql, files, mapping);

    return reply.send({
      data: {
        status: result.status,
        importedAt: result.importedAt.toISOString(),
        details: result.details,
      },
      error: null,
    });
  });

  app.post(
    "/api/liabilities",
    async (
      request: FastifyRequest<{
        Body: {
          entityCode: string;
          name: string;
          type: string;
          status?: string;
          originalAmount?: number;
          currentBalance?: number;
        };
      }>,
      reply: FastifyReply,
    ) => {
      const { entityCode, name, type } = request.body;
      const status = request.body.status ?? "active";
      const originalAmount = request.body.originalAmount ?? 0;
      const currentBalance = request.body.currentBalance ?? 0;

      const result = await sql`
        INSERT INTO liability (entity_code, name, type, status, original_amount, current_balance, config)
        VALUES (${entityCode}, ${name}, ${type}, ${status}, ${originalAmount}, ${currentBalance}, '{}')
        RETURNING id, entity_code, name, type, status
      `;

      return reply.status(201).send({
        data: {
          id: result[0].id,
          entityCode: result[0].entity_code,
          name: result[0].name,
          type: result[0].type,
          status: result[0].status,
        },
        error: null,
      });
    },
  );

  // Update liability (type change or manual schedule entry)
  app.patch(
    "/api/liabilities/:id",
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          type?: string;
          manualEntry?: {
            remainingAmount: number;
            installments: number;
            monthlyCapital: number;
            monthlyInterest: number;
          };
        };
      }>,
      reply: FastifyReply,
    ) => {
      const id = Number(request.params.id);
      const { type, manualEntry } = request.body;

      // Update type if provided
      if (type) {
        await sql`UPDATE liability SET type = ${type} WHERE id = ${id}`;
      }

      // Generate schedule from manual entry
      if (manualEntry) {
        const {
          remainingAmount,
          installments: numInstallments,
          monthlyCapital,
          monthlyInterest,
        } = manualEntry;

        await sql.begin(async (tx) => {
          await tx`DELETE FROM liability_schedule WHERE liability_id = ${id}`;

          const newConfig = JSON.stringify({
            manualEntry: {
              enteredAt: new Date().toISOString(),
              remainingAmount,
              installments: numInstallments,
              monthlyCapital,
              monthlyInterest,
            },
          });
          await tx`
            UPDATE liability
            SET current_balance = ${remainingAmount},
                original_amount = ${remainingAmount},
                config = ${newConfig}::jsonb
            WHERE id = ${id}
          `;

          let balance = remainingAmount;
          const today = new Date();

          for (let i = 1; i <= numInstallments; i++) {
            const paymentDate = new Date(today);
            paymentDate.setMonth(paymentDate.getMonth() + i);
            paymentDate.setDate(1);

            const isLast = i === numInstallments;
            // Last installment: balloon payment (remaining balance)
            const capital = isLast ? balance : Math.min(monthlyCapital, balance);
            const interest = monthlyInterest;
            const total = capital + interest;

            await tx`
              INSERT INTO liability_schedule (
                liability_id, payment_date, capital, interest, total, installment_number
              ) VALUES (
                ${id},
                ${paymentDate.toISOString().slice(0, 10)},
                ${capital}, ${interest}, ${total},
                ${i}
              )
            `;

            balance -= capital;
            if (balance <= 0) break;
          }
        });
      }

      const result = await sql`
        SELECT id, entity_code, name, type, status, config
        FROM liability WHERE id = ${id}
      `;

      if (result.length === 0) {
        return reply.status(404).send({
          data: null,
          error: {
            code: "NOT_FOUND",
            message: "Zobowiazanie nie znalezione",
          },
        });
      }

      return reply.send({
        data: {
          id: result[0].id,
          entityCode: result[0].entity_code,
          name: result[0].name,
          type: result[0].type,
          status: result[0].status,
          config: result[0].config,
        },
        error: null,
      });
    },
  );

  app.get("/api/import/status", async (_request, reply) => {
    const rows = await sql`
      SELECT id, imported_at, status, details
      FROM import_log
      WHERE status = 'success'
      ORDER BY imported_at DESC
      LIMIT 20
    `;

    // Categorize by type based on details content
    let saldeo: { importedAt: string; files: string[] } | null = null;
    let warehouse: { importedAt: string; files: string[] } | null = null;
    let schedules: { importedAt: string; files: string[] } | null = null;

    for (const row of rows) {
      const details =
        typeof row.details === "string"
          ? JSON.parse(row.details)
          : row.details;
      const files: string[] = details.files ?? [];
      const importedAt = new Date(row.imported_at).toISOString();

      if (!saldeo && details.invoiceCount !== undefined) {
        saldeo = { importedAt, files };
      } else if (!warehouse && details.warehouseItemCount !== undefined) {
        warehouse = { importedAt, files };
      } else if (!schedules && details.scheduleCount !== undefined) {
        schedules = { importedAt, files };
      }

      if (saldeo && warehouse && schedules) break;
    }

    return reply.send({
      data: { saldeo, warehouse, schedules },
    });
  });
}
