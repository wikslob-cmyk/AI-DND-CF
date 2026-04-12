import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";

vi.mock("../../db/connection.js", () => {
  const mockSql = vi.fn();
  return { sql: mockSql };
});

import { sql } from "../../db/connection.js";
import { registerPayablesRoutes } from "../payables.js";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cookie);
  await app.register(jwt, { secret: "test-secret" });
  await registerPayablesRoutes(app);
  return app;
}

function signToken(app: FastifyInstance): string {
  return app.jwt.sign({ authenticated: true });
}

describe("payables routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
    mockSql.mockReset();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET payables returns FZ invoices grouped by NIP", async () => {
    const inThreeDays = new Date(Date.now() + 3 * 86400000)
      .toISOString()
      .split("T")[0];

    mockSql.mockResolvedValueOnce([
      {
        id: 1,
        entity_code: "cgesp",
        document_number: "FZ/001",
        document_type: "FZ",
        contractor_name: "Dostawca X",
        contractor_nip: "1111111111",
        payment_due: inThreeDays,
        currency: "PLN",
        gross_value: "15000.00",
        remaining_amount: "15000.00",
        rate_pln: "1",
      },
    ]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/payables?entity=all&period=7d",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.groups).toHaveLength(1);
    expect(body.data.groups[0].contractorNip).toBe("1111111111");
    expect(body.data.totalPln).toBe(15000);
  });

  it("returns 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/payables?entity=all&period=7d",
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 400 for invalid entity param", async () => {
    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/payables?entity=xxx&period=7d",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
