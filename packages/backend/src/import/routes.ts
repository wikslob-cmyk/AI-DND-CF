import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../auth/middleware.js";
import {
  importSaldeoFiles,
  importWarehouseFile,
  importScheduleFiles,
  type FileInput,
  type DbAdapter,
} from "./orchestrator.js";
import type { FallbackRateProvider } from "../services/nbp-rates.js";

function createStubDbAdapter(): DbAdapter {
  // Stub adapter — will be replaced with real DB adapter in Unit 8+
  return {
    async beginTransaction() {},
    async commitTransaction() {},
    async rollbackTransaction() {},
    async deleteInvoices() {},
    async insertInvoices() {},
    async deleteWarehouseItems() {},
    async insertWarehouseItems() {},
    async insertExchangeRate() {},
    async insertImportLog() {
      return 1;
    },
    async deleteScheduleEntries() {},
    async insertScheduleEntries() {},
    async findLiabilityId() {
      return null;
    },
  };
}

function createStubFallbackProvider(): FallbackRateProvider {
  return {
    async getLastRate() {
      return null;
    },
  };
}

export async function registerImportRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  app.post("/api/import/saldeo", async (request, reply) => {
    const parts = request.parts();
    const files: FileInput[] = [];

    for await (const part of parts) {
      if (part.type === "file") {
        const buffer = await part.toBuffer();
        files.push({ filename: part.filename, buffer });
      }
    }

    if (files.length === 0) {
      return reply.status(400).send({
        error: { code: "NO_FILES", message: "No files uploaded" },
      });
    }

    const db = createStubDbAdapter();
    const fallback = createStubFallbackProvider();

    const result = await importSaldeoFiles(files, db, fallback);

    const status = result.status === "success" ? 200 : 422;
    return reply.status(status).send({ data: result });
  });

  app.post("/api/import/warehouse", async (request, reply) => {
    const parts = request.parts();
    let file: FileInput | null = null;

    for await (const part of parts) {
      if (part.type === "file") {
        const buffer = await part.toBuffer();
        file = { filename: part.filename, buffer };
        break;
      }
    }

    if (!file) {
      return reply.status(400).send({
        error: { code: "NO_FILE", message: "No file uploaded" },
      });
    }

    const db = createStubDbAdapter();
    const result = await importWarehouseFile(file, db);

    const status = result.status === "success" ? 200 : 422;
    return reply.status(status).send({ data: result });
  });

  app.post("/api/import/schedules", async (request, reply) => {
    const parts = request.parts();
    const files: FileInput[] = [];

    for await (const part of parts) {
      if (part.type === "file") {
        const buffer = await part.toBuffer();
        files.push({ filename: part.filename, buffer });
      }
    }

    if (files.length === 0) {
      return reply.status(400).send({
        error: { code: "NO_FILES", message: "No files uploaded" },
      });
    }

    const db = createStubDbAdapter();
    const result = await importScheduleFiles(files, db);

    const status = result.status === "success" ? 200 : 422;
    return reply.status(status).send({ data: result });
  });

  app.get("/api/import/status", async (_request, reply) => {
    // Stub — will query import_log table
    return reply.send({
      data: {
        lastImport: null,
        message: "No imports yet",
      },
    });
  });
}
