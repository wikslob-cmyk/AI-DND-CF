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
import { registerForecastRoutes } from "../forecast.js";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cookie);
  await app.register(jwt, { secret: "test-secret" });
  await registerForecastRoutes(app);
  return app;
}

function signToken(app: FastifyInstance): string {
  return app.jwt.sign({ authenticated: true });
}

describe("forecast routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
    mockSql.mockReset();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET forecast?days=30 returns receivables grouped per week", async () => {
    const in5days = new Date(Date.now() + 5 * 86400000)
      .toISOString()
      .split("T")[0];

    // future receivables
    mockSql.mockResolvedValueOnce([
      {
        id: 1,
        entity_code: "cgesp",
        document_number: "FS/001",
        document_type: "FS",
        contractor_name: "Client A",
        contractor_nip: "1234567890",
        payment_due: in5days,
        currency: "PLN",
        gross_value: "10000.00",
        remaining_amount: "10000.00",
        rate_pln: "1",
      },
    ]);

    // overdue
    mockSql.mockResolvedValueOnce([]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/forecast?days=30",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.forecast.totalPln).toBe(10000);
    expect(body.data.forecast.weeks.length).toBeGreaterThanOrEqual(4);
    expect(body.data.overdue.totalPln).toBe(0);
  });

  it("overdue not included in forecast total", async () => {
    // future
    mockSql.mockResolvedValueOnce([]);

    // overdue
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];
    mockSql.mockResolvedValueOnce([
      {
        id: 2,
        entity_code: "dngro",
        document_number: "FS/002",
        document_type: "FS",
        contractor_name: "Late Payer",
        contractor_nip: "9999999999",
        payment_due: yesterday,
        currency: "PLN",
        gross_value: "5000.00",
        remaining_amount: "5000.00",
        rate_pln: "1",
      },
    ]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/forecast?days=30",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.forecast.totalPln).toBe(0);
    expect(body.data.overdue.totalPln).toBe(5000);
  });
});
