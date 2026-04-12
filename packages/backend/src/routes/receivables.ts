import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "../auth/middleware.js";
import { queryInvoices } from "../db/invoice-queries.js";
import { validateEntity } from "./validate-entity.js";

interface InvoiceQuery {
  entity?: string;
  period?: string;
}

export async function registerReceivablesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

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
}

export { queryInvoices };
