import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sql } from "../db/connection.js";
import { authMiddleware } from "../auth/middleware.js";
import {
  queryInvoiceTotalPln,
  queryOverdueTotalPln,
} from "../db/invoice-queries.js";
import { validateEntity } from "./validate-entity.js";

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
      const entity = validateEntity(request.query.entity, reply);
      if (entity === null) return;

      const today = new Date();
      const todayStr = today.toISOString().split("T")[0] as string;
      const in30Str = new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .split("T")[0] as string;

      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1;

      // 1. Receivables total (all unpaid = overdue + future)
      const receivablesTotal = await queryInvoiceTotalPln(
        "FS",
        entity,
        "1900-01-01",
        "2099-12-31",
      );

      // 2. Payables total (all unpaid = overdue + future)
      const payablesTotal = await queryInvoiceTotalPln(
        "FZ",
        entity,
        "1900-01-01",
        "2099-12-31",
      );

      // Overdue payables
      const overduePayables = await queryOverdueTotalPln(
        "FZ",
        entity,
        todayStr,
      );

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
      const overdueReceivables = await queryOverdueTotalPln(
        "FS",
        entity,
        todayStr,
      );

      return reply.send({
        data: {
          entity,
          receivablesTotal,
          overdueReceivables,
          payablesTotal,
          overduePayables,
          liabilities30d: liabilitiesTotal,
          bankBalance: Number(balanceRow?.total ?? 0),
          warehouseValue,
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
