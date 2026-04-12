import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";

vi.mock("../../db/connection.js", () => {
  const mockCheckConnection = vi.fn();
  const mockSql = vi.fn();
  return { sql: mockSql, checkConnection: mockCheckConnection };
});

import { checkConnection } from "../../db/connection.js";

const mockCheckConnection = checkConnection as unknown as ReturnType<
  typeof vi.fn
>;

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cookie);
  await app.register(jwt, { secret: "test-secret" });

  app.get("/api/health", async (_request, reply) => {
    const dbConnected = await checkConnection();
    const status = dbConnected ? "ok" : "degraded";
    const statusCode = dbConnected ? 200 : 503;

    return reply.status(statusCode).send({
      status,
      timestamp: new Date().toISOString(),
      checks: {
        database: dbConnected ? "connected" : "disconnected",
      },
    });
  });

  return app;
}

describe("health endpoint", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
    mockCheckConnection.mockReset();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 200 when database is connected", async () => {
    mockCheckConnection.mockResolvedValue(true);

    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBe("ok");
    expect(body.checks.database).toBe("connected");
    expect(body.timestamp).toBeDefined();
  });

  it("returns 503 when database is disconnected", async () => {
    mockCheckConnection.mockResolvedValue(false);

    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(503);

    const body = JSON.parse(response.body);
    expect(body.status).toBe("degraded");
    expect(body.checks.database).toBe("disconnected");
  });
});
