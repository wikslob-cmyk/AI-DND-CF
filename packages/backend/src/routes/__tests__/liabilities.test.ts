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
import { registerLiabilitiesRoutes } from "../liabilities.js";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cookie);
  await app.register(jwt, { secret: "test-secret" });
  await registerLiabilitiesRoutes(app);
  return app;
}

function signToken(app: FastifyInstance): string {
  return app.jwt.sign({ authenticated: true });
}

describe("liabilities routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
    mockSql.mockReset();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET liabilities?entity=all returns all 15+ positions including rolling", async () => {
    const allLiabilities = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      entity_code: "cgesp",
      name: `Liability ${i + 1}`,
      type: i < 12 ? "leasing" : "info",
      status: i < 12 ? "active" : "informational",
      original_amount: "100000.00",
      current_balance: "50000.00",
      source_file: null,
      config: {},
    }));

    mockSql.mockResolvedValueOnce(allLiabilities);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/liabilities?entity=all",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.liabilities).toHaveLength(15);
  });

  it("GET liabilities?type=info returns only informational", async () => {
    const infoLiabilities = [
      {
        id: 13,
        entity_code: "cgesp",
        name: "ISAG (IKEA)",
        type: "info",
        status: "informational",
        original_amount: "0.00",
        current_balance: "0.00",
        source_file: null,
        config: {},
      },
      {
        id: 14,
        entity_code: "cgesp",
        name: "NCBiR",
        type: "info",
        status: "informational",
        original_amount: "750000.00",
        current_balance: "750000.00",
        source_file: null,
        config: {},
      },
      {
        id: 15,
        entity_code: "cgesp",
        name: "PARP",
        type: "info",
        status: "informational",
        original_amount: "950000.00",
        current_balance: "950000.00",
        source_file: null,
        config: {},
      },
    ];

    mockSql.mockResolvedValueOnce(infoLiabilities);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/liabilities?entity=all&type=info",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.liabilities).toHaveLength(3);
    expect(
      body.data.liabilities.every(
        (l: { status: string }) => l.status === "informational",
      ),
    ).toBe(true);
  });

  it("GET liabilities/schedule?months=12 returns schedule per month", async () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = nextMonth.toISOString().split("T")[0];

    // First call: schedule entries
    mockSql.mockResolvedValueOnce([
      {
        id: 1,
        liability_id: 1,
        payment_date: nextMonthStr,
        capital: "2000.00",
        interest: "500.00",
        total: "2500.00",
        installment_number: 1,
        liability_name: "Millennium piec",
        entity_code: "cgesp",
      },
    ]);

    // Second call: rolling liabilities
    mockSql.mockResolvedValueOnce([
      {
        id: 10,
        entity_code: "dngro",
        name: "ING limit",
        type: "limit",
        status: "active",
        config: { monthly_capital: 70000, monthly_interest: 18000 },
      },
    ]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/liabilities/schedule?entity=all&months=12",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.schedule.length).toBeGreaterThan(0);
    // Rolling entries should be added per month
    const totalMonths = body.data.schedule.length;
    expect(totalMonths).toBeGreaterThanOrEqual(1);
  });
});
