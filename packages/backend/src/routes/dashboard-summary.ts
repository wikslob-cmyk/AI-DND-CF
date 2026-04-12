import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sql } from "../db/connection.js";
import { authMiddleware } from "../auth/middleware.js";

interface SummaryQuery {
  entity?: string;
}

export async function registerDashboardSummaryRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  app.get(
    "/api/dashboard/summary",
    async (
      request: FastifyRequest<{ Querystring: SummaryQuery }>,
      reply: FastifyReply,
    ) => {
      const entity = request.query.entity || "all";
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0] as string;
      const in30Str = new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .split("T")[0] as string;

      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      // 1. Receivables total (next 30 days)
      const [receivablesRow] = entity === "all"
        ? await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = 'FS'
            AND i.payment_due >= ${todayStr}
            AND i.payment_due < ${in30Str}
        `
        : await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = 'FS'
            AND i.payment_due >= ${todayStr}
            AND i.payment_due < ${in30Str}
            AND i.entity_code = ${entity}
        `;

      // 2. Payables total (next 30 days)
      const [payablesRow] = entity === "all"
        ? await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = 'FZ'
            AND i.payment_due >= ${todayStr}
            AND i.payment_due < ${in30Str}
        `
        : await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = 'FZ'
            AND i.payment_due >= ${todayStr}
            AND i.payment_due < ${in30Str}
            AND i.entity_code = ${entity}
        `;

      // 3. Financial liabilities (next 30 days)
      let liabilitiesTotal = 0;

      if (entity === "all") {
        const [scheduleRow] = await sql`
          SELECT COALESCE(SUM(ls.total), 0) AS total
          FROM liability_schedule ls
          JOIN liability l ON l.id = ls.liability_id
          WHERE ls.payment_date >= ${todayStr}
            AND ls.payment_date < ${in30Str}
            AND l.status = 'active'
        `;
        liabilitiesTotal = Number(scheduleRow?.total ?? 0);

        const rollingRows = await sql`
          SELECT config FROM liability
          WHERE type IN ('limit', 'factoring')
            AND status = 'active'
        `;
        for (const r of rollingRows) {
          const config = r.config as {
            monthly_capital?: number;
            monthly_interest?: number;
          };
          liabilitiesTotal +=
            (config.monthly_capital ?? 0) + (config.monthly_interest ?? 0);
        }
      } else {
        const [scheduleRow] = await sql`
          SELECT COALESCE(SUM(ls.total), 0) AS total
          FROM liability_schedule ls
          JOIN liability l ON l.id = ls.liability_id
          WHERE l.entity_code = ${entity}
            AND ls.payment_date >= ${todayStr}
            AND ls.payment_date < ${in30Str}
            AND l.status = 'active'
        `;
        liabilitiesTotal = Number(scheduleRow?.total ?? 0);

        const rollingRows = await sql`
          SELECT config FROM liability
          WHERE entity_code = ${entity}
            AND type IN ('limit', 'factoring')
            AND status = 'active'
        `;
        for (const r of rollingRows) {
          const config = r.config as {
            monthly_capital?: number;
            monthly_interest?: number;
          };
          liabilitiesTotal +=
            (config.monthly_capital ?? 0) + (config.monthly_interest ?? 0);
        }
      }

      // 4. Bank balance
      const [balanceRow] = entity === "all"
        ? await sql`
          SELECT COALESCE(SUM(bank_balance), 0) AS total
          FROM monthly_input
          WHERE year = ${currentYear}
            AND month = ${currentMonth}
        `
        : await sql`
          SELECT COALESCE(SUM(bank_balance), 0) AS total
          FROM monthly_input
          WHERE year = ${currentYear}
            AND month = ${currentMonth}
            AND entity_code = ${entity}
        `;

      // 5. Warehouse value (only dngro)
      let warehouseValue = 0;
      if (entity === "all" || entity === "dngro") {
        const [warehouseRow] = await sql`
          SELECT COALESCE(SUM(value_total), 0) AS total
          FROM warehouse_item
          WHERE entity_code = 'dngro'
        `;
        warehouseValue = Number(warehouseRow?.total ?? 0);
      }

      // 6. Last import date
      const [importRow] = await sql`
        SELECT imported_at, status
        FROM import_log
        ORDER BY imported_at DESC
        LIMIT 1
      `;

      // 7. Overdue receivables
      const [overdueRow] = entity === "all"
        ? await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = 'FS'
            AND i.payment_due < ${todayStr}
        `
        : await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = 'FS'
            AND i.payment_due < ${todayStr}
            AND i.entity_code = ${entity}
        `;

      return reply.send({
        data: {
          entity,
          receivables30d: Number(receivablesRow?.total ?? 0),
          payables30d: Number(payablesRow?.total ?? 0),
          liabilities30d: liabilitiesTotal,
          bankBalance: Number(balanceRow?.total ?? 0),
          warehouseValue,
          overdueReceivables: Number(overdueRow?.total ?? 0),
          lastImport: importRow
            ? {
                importedAt: importRow.imported_at,
                status: importRow.status,
              }
            : null,
        },
      });
    },
  );
}
