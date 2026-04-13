import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "../auth/middleware.js";
import { queryInvoices, queryAllInvoices } from "../db/invoice-queries.js";
import { RELATED_NIPS } from "../db/related-nips.js";
import { validateEntity } from "./validate-entity.js";

interface InvoiceQuery {
  entity?: string;
  period?: string;
}

export async function registerReceivablesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  // Legacy endpoint (used by dashboard summary)
  app.get(
    "/api/receivables",
    async (
      request: FastifyRequest<{ Querystring: InvoiceQuery }>,
      reply: FastifyReply,
    ) => {
      const entity = validateEntity(request.query.entity, reply);
      if (entity === null) return;

      const period = request.query.period || "7d";

      const result = await queryInvoices("FS", entity, period);

      return reply.send({
        data: {
          entity,
          period,
          ...result,
        },
      });
    },
  );

  // All invoices + summary for analytics view (excludes related parties)
  app.get(
    "/api/receivables/all",
    async (
      request: FastifyRequest<{ Querystring: { entity?: string } }>,
      reply: FastifyReply,
    ) => {
      const entity = validateEntity(request.query.entity, reply);
      if (entity === null) return;

      const result = await queryAllInvoices("FS", entity, [...RELATED_NIPS]);

      return reply.send({ data: result });
    },
  );
}
