import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sql } from "../db/connection.js";
import { authMiddleware } from "../auth/middleware.js";

interface MonthlyInputQuery {
  entity: string;
  year: string;
  month: string;
}

interface MonthlyInputBody {
  entityCode: string;
  year: number;
  month: number;
  vatRefund: number;
  salariesNet: number;
  bankBalance: number;
}

const PUT_SCHEMA = {
  body: {
    type: "object",
    required: [
      "entityCode",
      "year",
      "month",
      "vatRefund",
      "salariesNet",
      "bankBalance",
    ],
    properties: {
      entityCode: { type: "string", minLength: 1 },
      year: { type: "number", minimum: 2020, maximum: 2100 },
      month: { type: "number", minimum: 1, maximum: 12 },
      vatRefund: { type: "number" },
      salariesNet: { type: "number" },
      bankBalance: { type: "number" },
    },
    additionalProperties: false,
  },
};

export async function registerMonthlyInputRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  app.get(
    "/api/monthly-input",
    async (
      request: FastifyRequest<{ Querystring: MonthlyInputQuery }>,
      reply: FastifyReply,
    ) => {
      const { entity, year, month } = request.query;

      if (!entity || !year || !month) {
        return reply.status(400).send({
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "Wymagane parametry: entity, year, month",
          },
        });
      }

      const yearNum = Number(year);
      const monthNum = Number(month);

      if (Number.isNaN(yearNum) || Number.isNaN(monthNum)) {
        return reply.status(400).send({
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "year i month muszą być liczbami",
          },
        });
      }

      const rows = await sql`
        SELECT
          id,
          entity_code,
          year,
          month,
          vat_refund,
          salaries_net,
          bank_balance,
          updated_at
        FROM monthly_input
        WHERE entity_code = ${entity}
          AND year = ${yearNum}
          AND month = ${monthNum}
      `;

      const row = rows[0];

      return reply.send({
        data: row
          ? {
              id: row.id,
              entityCode: row.entity_code,
              year: row.year,
              month: row.month,
              vatRefund: Number(row.vat_refund),
              salariesNet: Number(row.salaries_net),
              bankBalance: Number(row.bank_balance),
              updatedAt: row.updated_at,
            }
          : null,
      });
    },
  );

  app.put(
    "/api/monthly-input",
    { schema: PUT_SCHEMA },
    async (
      request: FastifyRequest<{ Body: MonthlyInputBody }>,
      reply: FastifyReply,
    ) => {
      const { entityCode, year, month, vatRefund, salariesNet, bankBalance } =
        request.body;

      const result = await sql`
        INSERT INTO monthly_input (entity_code, year, month, vat_refund, salaries_net, bank_balance, updated_at)
        VALUES (${entityCode}, ${year}, ${month}, ${vatRefund}, ${salariesNet}, ${bankBalance}, NOW())
        ON CONFLICT (entity_code, year, month)
        DO UPDATE SET
          vat_refund = ${vatRefund},
          salaries_net = ${salariesNet},
          bank_balance = ${bankBalance},
          updated_at = NOW()
        RETURNING id, entity_code, year, month, vat_refund, salaries_net, bank_balance, updated_at
      `;

      const row = result[0]!;

      return reply.send({
        data: {
          id: row.id,
          entityCode: row.entity_code,
          year: row.year,
          month: row.month,
          vatRefund: Number(row.vat_refund),
          salariesNet: Number(row.salaries_net),
          bankBalance: Number(row.bank_balance),
          updatedAt: row.updated_at,
        },
      });
    },
  );
}
