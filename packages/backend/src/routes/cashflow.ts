import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "../auth/middleware.js";
import { calculateCashflowProjection } from "../services/cashflow-projection.js";

interface CashflowQuery {
  days?: string;
}

export async function registerCashflowRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  app.get(
    "/api/cashflow",
    async (
      request: FastifyRequest<{ Querystring: CashflowQuery }>,
      reply: FastifyReply,
    ) => {
      const days = Math.min(Math.max(Number(request.query.days) || 30, 1), 90);

      const result = await calculateCashflowProjection(days);

      return reply.send({ data: result });
    },
  );
}
