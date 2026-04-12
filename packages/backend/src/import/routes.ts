import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../auth/middleware.js";

export async function registerImportRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  app.post("/api/import/saldeo", async (_request, reply) => {
    // TODO: Replace with real DB adapter in Unit 8+
    return reply.status(501).send({
      error: {
        code: "NOT_IMPLEMENTED",
        message:
          "Database adapter not connected. Import Saldeo will be available after Unit 8.",
      },
    });
  });

  app.post("/api/import/warehouse", async (_request, reply) => {
    // TODO: Replace with real DB adapter in Unit 8+
    return reply.status(501).send({
      error: {
        code: "NOT_IMPLEMENTED",
        message:
          "Database adapter not connected. Import warehouse will be available after Unit 8.",
      },
    });
  });

  app.post("/api/import/schedules", async (_request, reply) => {
    // TODO: Replace with real DB adapter in Unit 8+
    return reply.status(501).send({
      error: {
        code: "NOT_IMPLEMENTED",
        message:
          "Database adapter not connected. Import schedules will be available after Unit 8.",
      },
    });
  });

  app.get("/api/import/status", async (_request, reply) => {
    // TODO(Unit 8): Query import_log table when real DB adapter is connected
    return reply.send({
      data: {
        lastImport: null,
        message: "No imports yet",
      },
    });
  });
}
