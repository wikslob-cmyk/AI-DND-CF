import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sql } from "../db/connection.js";
import { authMiddleware } from "../auth/middleware.js";
import {
  queryInvoiceTotalPln,
  queryOverdueTotalPln,
} from "../db/invoice-queries.js";
import { RELATED_NIPS } from "../db/related-nips.js";
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

      const excludeNips = [...RELATED_NIPS];

      // 1. Receivables total (all unpaid = overdue + future)
      const receivablesTotal = await queryInvoiceTotalPln(
        "FS",
        entity,
        "1900-01-01",
        "2099-12-31",
        excludeNips,
      );

      // 2. Payables total (all unpaid = overdue + future)
      const payablesTotal = await queryInvoiceTotalPln(
        "FZ",
        entity,
        "1900-01-01",
        "2099-12-31",
        excludeNips,
      );

      // Overdue payables
      const overduePayables = await queryOverdueTotalPln(
        "FZ",
        entity,
        todayStr,
        excludeNips,
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

      // 4. Bank balance, salaries, VAT refund
      const [monthlyRow] = entity === "all"
        ? await sql`
          SELECT
            COALESCE(SUM(bank_balance), 0) AS bank_total,
            COALESCE(SUM(salaries_net), 0) AS salaries_total,
            COALESCE(SUM(vat_refund), 0) AS vat_refund_total
          FROM monthly_input
          WHERE year = ${currentYear}
            AND month = ${currentMonth}
        `
        : await sql`
          SELECT
            COALESCE(SUM(bank_balance), 0) AS bank_total,
            COALESCE(SUM(salaries_net), 0) AS salaries_total,
            COALESCE(SUM(vat_refund), 0) AS vat_refund_total
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

      // 7. Manual entries (outside Saldeo) — converted to PLN via latest NBP rate
      const manualRows =
        entity === "all"
          ? await sql`
              SELECT me.id, me.name, me.entry_type, me.gross_value, me.currency,
                CASE WHEN me.currency = 'PLN' THEN me.gross_value
                     ELSE me.gross_value * COALESCE(er.rate_pln, 1)
                END AS gross_value_pln
              FROM manual_entry me
              LEFT JOIN LATERAL (
                SELECT rate_pln FROM exchange_rate
                WHERE currency = me.currency
                ORDER BY rate_date DESC LIMIT 1
              ) er ON TRUE
              ORDER BY me.created_at
            `
          : await sql`
              SELECT me.id, me.name, me.entry_type, me.gross_value, me.currency,
                CASE WHEN me.currency = 'PLN' THEN me.gross_value
                     ELSE me.gross_value * COALESCE(er.rate_pln, 1)
                END AS gross_value_pln
              FROM manual_entry me
              LEFT JOIN LATERAL (
                SELECT rate_pln FROM exchange_rate
                WHERE currency = me.currency
                ORDER BY rate_date DESC LIMIT 1
              ) er ON TRUE
              WHERE me.entity_code = ${entity}
              ORDER BY me.created_at
            `;

      function mapManualEntry(r: Record<string, unknown>) {
        return {
          id: r.id as number,
          name: r.name as string,
          grossValue: Number(r.gross_value),
          grossValuePln: Number(r.gross_value_pln),
          currency: r.currency as string,
        };
      }

      const manualReceivables = manualRows
        .filter((r) => r.entry_type === "receivable")
        .map(mapManualEntry);
      const manualPayables = manualRows
        .filter((r) => r.entry_type === "payable")
        .map(mapManualEntry);

      // 8. Overdue receivables
      const overdueReceivables = await queryOverdueTotalPln(
        "FS",
        entity,
        todayStr,
        excludeNips,
      );

      return reply.send({
        data: {
          entity,
          receivablesTotal,
          overdueReceivables,
          payablesTotal,
          overduePayables,
          liabilities30d: liabilitiesTotal,
          bankBalance: Number(monthlyRow?.bank_total ?? 0),
          salaries: Number(monthlyRow?.salaries_total ?? 0),
          vatRefund: Number(monthlyRow?.vat_refund_total ?? 0),
          warehouseValue,
          manualReceivables,
          manualPayables,
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
