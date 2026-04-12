import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "../auth/middleware.js";
import { queryInvoices } from "./receivables.js";

interface InvoiceQuery {
  entity?: string;
  period?: string;
}

export async function registerPayablesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  app.get(
    "/api/payables",
    async (
      request: FastifyRequest<{ Querystring: InvoiceQuery }>,
      reply: FastifyReply,
    ) => {
      const entity = request.query.entity || "all";
      const period = request.query.period || "7d";

      const result = await queryInvoices("FZ", entity, period);

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
