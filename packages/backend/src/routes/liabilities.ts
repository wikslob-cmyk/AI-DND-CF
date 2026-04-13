import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sql } from "../db/connection.js";
import { authMiddleware } from "../auth/middleware.js";
import { validateEntity } from "./validate-entity.js";

interface LiabilityQuery {
  entity?: string;
  type?: string;
}

interface ScheduleQuery {
  entity?: string;
  months?: string;
}

export async function registerLiabilitiesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  app.get(
    "/api/liabilities",
    async (
      request: FastifyRequest<{ Querystring: LiabilityQuery }>,
      reply: FastifyReply,
    ) => {
      const entity = validateEntity(request.query.entity, reply);
      if (entity === null) return;

      const type = request.query.type || "all";

      let rows;

      if (entity === "all" && type === "all") {
        rows = await sql`
          SELECT l.*, COALESCE(s.cnt, 0) AS schedule_count,
                 COALESCE(s.remaining_capital, 0) AS remaining_capital,
                 COALESCE(s.remaining_total, 0) AS remaining_total
          FROM liability l
          LEFT JOIN (
            SELECT liability_id, COUNT(*) AS cnt,
                   SUM(CASE WHEN payment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN capital ELSE 0 END) AS remaining_capital,
                   SUM(CASE WHEN payment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN total ELSE 0 END) AS remaining_total
            FROM liability_schedule GROUP BY liability_id
          ) s ON s.liability_id = l.id
          ORDER BY l.entity_code, l.name
        `;
      } else if (entity === "all" && type === "info") {
        rows = await sql`
          SELECT l.*, COALESCE(s.cnt, 0) AS schedule_count,
                 COALESCE(s.remaining_capital, 0) AS remaining_capital,
                 COALESCE(s.remaining_total, 0) AS remaining_total
          FROM liability l
          LEFT JOIN (
            SELECT liability_id, COUNT(*) AS cnt,
                   SUM(CASE WHEN payment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN capital ELSE 0 END) AS remaining_capital,
                   SUM(CASE WHEN payment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN total ELSE 0 END) AS remaining_total
            FROM liability_schedule GROUP BY liability_id
          ) s ON s.liability_id = l.id
          WHERE l.status = 'informational'
          ORDER BY l.entity_code, l.name
        `;
      } else if (entity === "all") {
        rows = await sql`
          SELECT l.*, COALESCE(s.cnt, 0) AS schedule_count,
                 COALESCE(s.remaining_capital, 0) AS remaining_capital,
                 COALESCE(s.remaining_total, 0) AS remaining_total
          FROM liability l
          LEFT JOIN (
            SELECT liability_id, COUNT(*) AS cnt,
                   SUM(CASE WHEN payment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN capital ELSE 0 END) AS remaining_capital,
                   SUM(CASE WHEN payment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN total ELSE 0 END) AS remaining_total
            FROM liability_schedule GROUP BY liability_id
          ) s ON s.liability_id = l.id
          WHERE l.type = ${type}
          ORDER BY l.entity_code, l.name
        `;
      } else if (type === "all") {
        rows = await sql`
          SELECT l.*, COALESCE(s.cnt, 0) AS schedule_count,
                 COALESCE(s.remaining_capital, 0) AS remaining_capital,
                 COALESCE(s.remaining_total, 0) AS remaining_total
          FROM liability l
          LEFT JOIN (
            SELECT liability_id, COUNT(*) AS cnt,
                   SUM(CASE WHEN payment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN capital ELSE 0 END) AS remaining_capital,
                   SUM(CASE WHEN payment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN total ELSE 0 END) AS remaining_total
            FROM liability_schedule GROUP BY liability_id
          ) s ON s.liability_id = l.id
          WHERE l.entity_code = ${entity}
          ORDER BY l.name
        `;
      } else if (type === "info") {
        rows = await sql`
          SELECT l.*, COALESCE(s.cnt, 0) AS schedule_count,
                 COALESCE(s.remaining_capital, 0) AS remaining_capital,
                 COALESCE(s.remaining_total, 0) AS remaining_total
          FROM liability l
          LEFT JOIN (
            SELECT liability_id, COUNT(*) AS cnt,
                   SUM(CASE WHEN payment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN capital ELSE 0 END) AS remaining_capital,
                   SUM(CASE WHEN payment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN total ELSE 0 END) AS remaining_total
            FROM liability_schedule GROUP BY liability_id
          ) s ON s.liability_id = l.id
          WHERE l.entity_code = ${entity} AND l.status = 'informational'
          ORDER BY l.name
        `;
      } else {
        rows = await sql`
          SELECT l.*, COALESCE(s.cnt, 0) AS schedule_count,
                 COALESCE(s.remaining_capital, 0) AS remaining_capital,
                 COALESCE(s.remaining_total, 0) AS remaining_total
          FROM liability l
          LEFT JOIN (
            SELECT liability_id, COUNT(*) AS cnt,
                   SUM(CASE WHEN payment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN capital ELSE 0 END) AS remaining_capital,
                   SUM(CASE WHEN payment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN total ELSE 0 END) AS remaining_total
            FROM liability_schedule GROUP BY liability_id
          ) s ON s.liability_id = l.id
          WHERE l.entity_code = ${entity} AND l.type = ${type}
          ORDER BY l.name
        `;
      }

      const liabilities = rows.map((row) => {
        const type = row.type as string;
        // Balance from schedule (remaining total from 1st of month), fallback to current_balance
        const scheduleBalance = Number(row.remaining_total);
        const manualBalance = Number(row.current_balance);
        const balance = scheduleBalance > 0 ? scheduleBalance : manualBalance;

        return {
          id: row.id,
          entityCode: row.entity_code,
          name: row.name,
          type,
          status: row.status,
          currentBalance: balance,
          sourceFile: row.source_file,
          config: typeof row.config === "string" ? JSON.parse(row.config) : (row.config ?? {}),
          scheduleCount: Number(row.schedule_count),
        };
      });

      return reply.send({ data: { entity, type, liabilities } });
    },
  );

  app.get(
    "/api/liabilities/schedule",
    async (
      request: FastifyRequest<{ Querystring: ScheduleQuery }>,
      reply: FastifyReply,
    ) => {
      const entity = validateEntity(request.query.entity, reply);
      if (entity === null) return;

      const months = Math.min(Number(request.query.months) || 12, 36);

      const today = new Date();
      // Start from 1st of current month (show full current month)
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + months);
      const endDateStr = endDate.toISOString().split("T")[0] as string;
      const startDateStr = startDate.toISOString().split("T")[0] as string;

      let rows;

      if (entity === "all") {
        rows = await sql`
          SELECT
            ls.id,
            ls.liability_id,
            ls.payment_date,
            ls.capital,
            ls.interest,
            ls.total,
            ls.installment_number,
            l.name AS liability_name,
            l.entity_code
          FROM liability_schedule ls
          JOIN liability l ON l.id = ls.liability_id
          WHERE ls.payment_date >= ${startDateStr}
            AND ls.payment_date < ${endDateStr}
            AND l.status = 'active'
          ORDER BY ls.payment_date, l.entity_code, l.name
        `;
      } else {
        rows = await sql`
          SELECT
            ls.id,
            ls.liability_id,
            ls.payment_date,
            ls.capital,
            ls.interest,
            ls.total,
            ls.installment_number,
            l.name AS liability_name,
            l.entity_code
          FROM liability_schedule ls
          JOIN liability l ON l.id = ls.liability_id
          WHERE l.entity_code = ${entity}
            AND ls.payment_date >= ${startDateStr}
            AND ls.payment_date < ${endDateStr}
            AND l.status = 'active'
          ORDER BY ls.payment_date, l.name
        `;
      }

      // Also fetch rolling liabilities (ING limit, ING faktoring)
      let rollingRows;
      if (entity === "all") {
        rollingRows = await sql`
          SELECT * FROM liability
          WHERE type IN ('limit', 'factoring')
            AND status = 'active'
        `;
      } else {
        rollingRows = await sql`
          SELECT * FROM liability
          WHERE entity_code = ${entity}
            AND type IN ('limit', 'factoring')
            AND status = 'active'
        `;
      }

      // Group schedule entries by month
      const monthMap = new Map<
        string,
        {
          month: string;
          entries: Array<Record<string, unknown>>;
          totalCapital: number;
          totalInterest: number;
          totalAmount: number;
        }
      >();

      for (const row of rows) {
        const date = new Date(row.payment_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            month: monthKey,
            entries: [],
            totalCapital: 0,
            totalInterest: 0,
            totalAmount: 0,
          });
        }

        const group = monthMap.get(monthKey)!;
        const capital = Number(row.capital);
        const interest = Number(row.interest);
        const total = Number(row.total);

        group.entries.push({
          id: row.id,
          liabilityId: row.liability_id,
          liabilityName: row.liability_name,
          entityCode: row.entity_code,
          paymentDate: row.payment_date,
          capital,
          interest,
          total,
          installmentNumber: row.installment_number,
        });
        group.totalCapital += capital;
        group.totalInterest += interest;
        group.totalAmount += total;
      }

      // Add rolling entries per month
      for (const rolling of rollingRows) {
        const config = rolling.config as {
          monthly_capital?: number;
          monthly_interest?: number;
        };
        const monthlyCapital = config.monthly_capital ?? 0;
        const monthlyInterest = config.monthly_interest ?? 0;
        const monthlyTotal = monthlyCapital + monthlyInterest;

        for (let m = 0; m < months; m++) {
          const date = new Date(startDate);
          date.setMonth(date.getMonth() + m);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, {
              month: monthKey,
              entries: [],
              totalCapital: 0,
              totalInterest: 0,
              totalAmount: 0,
            });
          }

          const group = monthMap.get(monthKey)!;
          group.entries.push({
            id: null,
            liabilityId: rolling.id,
            liabilityName: rolling.name,
            entityCode: rolling.entity_code,
            paymentDate: `${monthKey}-01`,
            capital: monthlyCapital,
            interest: monthlyInterest,
            total: monthlyTotal,
            installmentNumber: m + 1,
            isRolling: true,
          });
          group.totalCapital += monthlyCapital;
          group.totalInterest += monthlyInterest;
          group.totalAmount += monthlyTotal;
        }
      }

      const schedule = Array.from(monthMap.values()).sort((a, b) =>
        a.month.localeCompare(b.month),
      );

      return reply.send({ data: { entity, months, schedule } });
    },
  );
}
