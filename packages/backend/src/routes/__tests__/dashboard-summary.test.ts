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
import { registerDashboardSummaryRoutes } from "../dashboard-summary.js";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cookie);
  await app.register(jwt, { secret: "test-secret" });
  await registerDashboardSummaryRoutes(app);
  return app;
}

function signToken(app: FastifyInstance): string {
  return app.jwt.sign({ authenticated: true });
}

describe("dashboard summary routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
    mockSql.mockReset();
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/summary?entity=all",
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 400 for invalid entity param", async () => {
    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/summary?entity=fake",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET dashboard/summary?entity=all returns aggregated sums", async () => {
    // receivables
    mockSql.mockResolvedValueOnce([{ total: "50000.00" }]);
    // payables
    mockSql.mockResolvedValueOnce([{ total: "30000.00" }]);
    // schedule
    mockSql.mockResolvedValueOnce([{ total: "15000.00" }]);
    // rolling
    mockSql.mockResolvedValueOnce([
      {
        config: { monthly_capital: 70000, monthly_interest: 18000 },
      },
    ]);
    // bank balance
    mockSql.mockResolvedValueOnce([{ total: "500000.00" }]);
    // warehouse
    mockSql.mockResolvedValueOnce([{ total: "200000.00" }]);
    // last import
    mockSql.mockResolvedValueOnce([
      {
        imported_at: "2026-04-12T10:00:00Z",
        status: "success",
      },
    ]);
    // overdue
    mockSql.mockResolvedValueOnce([{ total: "10000.00" }]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/summary?entity=all",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.receivables30d).toBe(50000);
    expect(body.data.payables30d).toBe(30000);
    expect(body.data.liabilities30d).toBe(15000 + 70000 + 18000);
    expect(body.data.bankBalance).toBe(500000);
    expect(body.data.warehouseValue).toBe(200000);
    expect(body.data.overdueReceivables).toBe(10000);
    expect(body.data.lastImport).not.toBeNull();
  });

  it("GET dashboard/summary?entity=cgesp returns only CGE sums", async () => {
    // receivables
    mockSql.mockResolvedValueOnce([{ total: "20000.00" }]);
    // payables
    mockSql.mockResolvedValueOnce([{ total: "10000.00" }]);
    // schedule
    mockSql.mockResolvedValueOnce([{ total: "5000.00" }]);
    // rolling (none for cgesp)
    mockSql.mockResolvedValueOnce([]);
    // bank balance
    mockSql.mockResolvedValueOnce([{ total: "100000.00" }]);
    // No warehouse query for cgesp (only dngro)
    // last import
    mockSql.mockResolvedValueOnce([]);
    // overdue
    mockSql.mockResolvedValueOnce([{ total: "3000.00" }]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/summary?entity=cgesp",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.entity).toBe("cgesp");
    expect(body.data.receivables30d).toBe(20000);
    expect(body.data.warehouseValue).toBe(0); // not dngro
  });

  it("currency amounts are converted to PLN", async () => {
    // The SQL itself handles conversion with exchange_rate join
    // This test verifies the aggregation returns correct numbers
    mockSql.mockResolvedValueOnce([{ total: "43200.00" }]); // receivables (EUR converted)
    mockSql.mockResolvedValueOnce([{ total: "0.00" }]);
    mockSql.mockResolvedValueOnce([{ total: "0.00" }]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ total: "0.00" }]);
    mockSql.mockResolvedValueOnce([{ total: "0.00" }]);
    mockSql.mockResolvedValueOnce([]);
    mockSql.mockResolvedValueOnce([{ total: "0.00" }]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/summary?entity=all",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.receivables30d).toBe(43200);
  });
});
