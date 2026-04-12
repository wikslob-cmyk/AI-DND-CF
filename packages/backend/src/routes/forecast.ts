import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sql } from "../db/connection.js";
import { authMiddleware } from "../auth/middleware.js";
import { toAmountPln } from "../db/invoice-queries.js";
import { validateEntity } from "./validate-entity.js";

interface ForecastQuery {
  days?: string;
  entity?: string;
}

interface WeekBucket {
  weekLabel: string;
  startDate: string;
  endDate: string;
  totalPln: number;
  invoices: Array<Record<string, unknown>>;
}

export async function registerForecastRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  app.get(
    "/api/forecast",
    async (
      request: FastifyRequest<{ Querystring: ForecastQuery }>,
      reply: FastifyReply,
    ) => {
      const entity = validateEntity(request.query.entity, reply);
      if (entity === null) return;

      const days = Math.min(Number(request.query.days) || 30, 90);

      const today = new Date();
      const todayStr = today.toISOString().split("T")[0] as string;
      const endDate = new Date(Date.now() + days * 86400000);
      const endDateStr = endDate.toISOString().split("T")[0] as string;

      // Future receivables (naive forecast)
      const futureRows = entity === "all"
        ? await sql`
          SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = 'FS'
            AND i.payment_due >= ${todayStr}
            AND i.payment_due < ${endDateStr}
          ORDER BY i.payment_due
        `
        : await sql`
          SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = 'FS'
            AND i.entity_code = ${entity}
            AND i.payment_due >= ${todayStr}
            AND i.payment_due < ${endDateStr}
          ORDER BY i.payment_due
        `;

      // Overdue receivables (separate section)
      const overdueRows = entity === "all"
        ? await sql`
          SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = 'FS'
            AND i.payment_due < ${todayStr}
          ORDER BY i.payment_due
        `
        : await sql`
          SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = 'FS'
            AND i.entity_code = ${entity}
            AND i.payment_due < ${todayStr}
          ORDER BY i.payment_due
        `;

      // Group future receivables by week
      const weeks: WeekBucket[] = [];
      const weekCount = Math.ceil(days / 7);

      for (let w = 0; w < weekCount; w++) {
        const weekStart = new Date(
          today.getTime() + w * 7 * 86400000,
        );
        const weekEnd = new Date(
          today.getTime() + (w + 1) * 7 * 86400000,
        );
        weeks.push({
          weekLabel: `Tydzień ${w + 1}`,
          startDate: weekStart.toISOString().split("T")[0] as string,
          endDate: weekEnd.toISOString().split("T")[0] as string,
          totalPln: 0,
          invoices: [],
        });
      }

      for (const row of futureRows) {
        const dueDate = new Date(row.payment_due);
        const daysDiff = Math.floor(
          (dueDate.getTime() - today.getTime()) / 86400000,
        );
        const weekIdx = Math.min(
          Math.floor(daysDiff / 7),
          weekCount - 1,
        );

        const remainingPln = toAmountPln(
          row.currency,
          row.remaining_amount,
          row.rate_pln,
        );

        const week = weeks[weekIdx];
        if (week) {
          week.totalPln += remainingPln;
          week.invoices.push({
            id: row.id,
            entityCode: row.entity_code,
            documentNumber: row.document_number,
            contractorName: row.contractor_name,
            paymentDue: row.payment_due,
            currency: row.currency,
            remainingAmount: Number(row.remaining_amount),
            remainingAmountPln: remainingPln,
          });
        }
      }

      // Process overdue
      let overdueTotalPln = 0;
      const overdueInvoices = overdueRows.map((row) => {
        const remainingPln = toAmountPln(
          row.currency,
          row.remaining_amount,
          row.rate_pln,
        );
        overdueTotalPln += remainingPln;
        return {
          id: row.id,
          entityCode: row.entity_code,
          documentNumber: row.document_number,
          contractorName: row.contractor_name,
          paymentDue: row.payment_due,
          currency: row.currency,
          remainingAmount: Number(row.remaining_amount),
          remainingAmountPln: remainingPln,
        };
      });

      const forecastTotalPln = weeks.reduce(
        (sum, w) => sum + w.totalPln,
        0,
      );

      return reply.send({
        data: {
          entity,
          days,
          forecast: {
            totalPln: forecastTotalPln,
            weeks,
          },
          overdue: {
            totalPln: overdueTotalPln,
            invoices: overdueInvoices,
          },
        },
      });
    },
  );
}
