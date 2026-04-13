import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sql } from "../db/connection.js";
import { authMiddleware } from "../auth/middleware.js";
import { validateEntity } from "./validate-entity.js";

interface ManualEntryBody {
  entityCode: string;
  name: string;
  entryType: "receivable" | "payable";
  grossValue: number;
  currency: string;
}

const POST_SCHEMA = {
  body: {
    type: "object",
    required: ["entityCode", "name", "entryType", "grossValue", "currency"],
    properties: {
      entityCode: { type: "string", minLength: 1 },
      name: { type: "string", minLength: 1, maxLength: 500 },
      entryType: { type: "string", enum: ["receivable", "payable"] },
      grossValue: { type: "number", exclusiveMinimum: 0 },
      currency: { type: "string", minLength: 3, maxLength: 3 },
    },
    additionalProperties: false,
  },
};

export async function registerManualEntryRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  app.get(
    "/api/manual-entries",
    async (
      request: FastifyRequest<{ Querystring: { entity?: string } }>,
      reply: FastifyReply,
    ) => {
      const entity = validateEntity(request.query.entity, reply);
      if (entity === null) return;

      const rows =
        entity === "all"
          ? await sql`
              SELECT id, entity_code, name, entry_type, gross_value, currency, created_at
              FROM manual_entry
              ORDER BY created_at DESC
            `
          : await sql`
              SELECT id, entity_code, name, entry_type, gross_value, currency, created_at
              FROM manual_entry
              WHERE entity_code = ${entity}
              ORDER BY created_at DESC
            `;

      return reply.send({
        data: rows.map((r) => ({
          id: r.id,
          entityCode: r.entity_code,
          name: r.name,
          entryType: r.entry_type,
          grossValue: Number(r.gross_value),
          currency: r.currency,
          createdAt: r.created_at,
        })),
      });
    },
  );

  app.post(
    "/api/manual-entries",
    { schema: POST_SCHEMA },
    async (
      request: FastifyRequest<{ Body: ManualEntryBody }>,
      reply: FastifyReply,
    ) => {
      const { entityCode, name, entryType, grossValue, currency } = request.body;

      const [row] = await sql`
        INSERT INTO manual_entry (entity_code, name, entry_type, gross_value, currency)
        VALUES (${entityCode}, ${name}, ${entryType}, ${grossValue}, ${currency})
        RETURNING id, entity_code, name, entry_type, gross_value, currency, created_at
      `;

      return reply.status(201).send({
        data: {
          id: row!.id,
          entityCode: row!.entity_code,
          name: row!.name,
          entryType: row!.entry_type,
          grossValue: Number(row!.gross_value),
          currency: row!.currency,
          createdAt: row!.created_at,
        },
      });
    },
  );

  app.delete(
    "/api/manual-entries/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const id = Number(request.params.id);

      if (Number.isNaN(id)) {
        return reply.status(400).send({
          data: null,
          error: { code: "VALIDATION_ERROR", message: "Nieprawidlowe ID" },
        });
      }

      const result = await sql`
        DELETE FROM manual_entry WHERE id = ${id} RETURNING id
      `;

      if (result.length === 0) {
        return reply.status(404).send({
          data: null,
          error: { code: "NOT_FOUND", message: "Pozycja nie znaleziona" },
        });
      }

      return reply.send({ data: { deleted: true } });
    },
  );
}
