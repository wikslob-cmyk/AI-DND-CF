import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";

vi.mock("../../db/connection.js", () => {
  const mockSql = vi.fn();
  return { sql: mockSql };
});

vi.mock("../../db/invoice-queries.js", () => ({
  queryInvoiceTotalPln: vi.fn(),
  queryOverdueTotalPln: vi.fn(),
}));

import { sql } from "../../db/connection.js";
import {
  queryInvoiceTotalPln,
  queryOverdueTotalPln,
} from "../../db/invoice-queries.js";
import { registerDashboardSummaryRoutes } from "../dashboard-summary.js";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockInvoiceTotal = queryInvoiceTotalPln as unknown as ReturnType<
  typeof vi.fn
>;
const mockOverdueTotal = queryOverdueTotalPln as unknown as ReturnType<
  typeof vi.fn
>;

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
    mockInvoiceTotal.mockReset();
    mockOverdueTotal.mockReset();
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
    // Invoice helpers: receivables (FS) then payables (FZ)
    mockInvoiceTotal.mockResolvedValueOnce(50000).mockResolvedValueOnce(30000);
    // Overdue helpers: payables (FZ) then receivables (FS)
    mockOverdueTotal.mockResolvedValueOnce(2000).mockResolvedValueOnce(10000);

    // Inline sql calls, in route order for entity=all:
    mockSql
      // schedule
      .mockResolvedValueOnce([{ total: "15000.00" }])
      // rolling (limit/factoring configs)
      .mockResolvedValueOnce([
        { config: { monthly_capital: 70000, monthly_interest: 18000 } },
      ])
      // monthly_input (bank / salaries / vat)
      .mockResolvedValueOnce([
        {
          bank_total: "500000.00",
          salaries_total: "40000.00",
          vat_refund_total: "5000.00",
        },
      ])
      // warehouse (dngro)
      .mockResolvedValueOnce([{ total: "200000.00" }])
      // last import
      .mockResolvedValueOnce([
        { imported_at: "2026-04-12T10:00:00Z", status: "success" },
      ])
      // manual entries
      .mockResolvedValueOnce([]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/summary?entity=all",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.entity).toBe("all");
    expect(body.data.receivablesTotal).toBe(50000);
    expect(body.data.payablesTotal).toBe(30000);
    expect(body.data.overduePayables).toBe(2000);
    expect(body.data.overdueReceivables).toBe(10000);
    expect(body.data.liabilities30d).toBe(15000 + 70000 + 18000);
    expect(body.data.bankBalance).toBe(500000);
    expect(body.data.salaries).toBe(40000);
    expect(body.data.vatRefund).toBe(5000);
    expect(body.data.warehouseValue).toBe(200000);
    expect(body.data.lastImport).not.toBeNull();
  });

  it("GET dashboard/summary?entity=cgesp returns only CGE sums and no warehouse", async () => {
    mockInvoiceTotal.mockResolvedValueOnce(20000).mockResolvedValueOnce(10000);
    mockOverdueTotal.mockResolvedValueOnce(1000).mockResolvedValueOnce(3000);

    // entity=cgesp skips the warehouse query (only 'all' or 'dngro' run it)
    mockSql
      // schedule
      .mockResolvedValueOnce([{ total: "5000.00" }])
      // rolling (none for cgesp)
      .mockResolvedValueOnce([])
      // monthly_input
      .mockResolvedValueOnce([
        {
          bank_total: "100000.00",
          salaries_total: "0.00",
          vat_refund_total: "0.00",
        },
      ])
      // last import
      .mockResolvedValueOnce([])
      // manual entries
      .mockResolvedValueOnce([]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/summary?entity=cgesp",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.entity).toBe("cgesp");
    expect(body.data.receivablesTotal).toBe(20000);
    expect(body.data.warehouseValue).toBe(0); // not dngro
    expect(body.data.lastImport).toBeNull();
  });

  it("manual entries are split into receivables and payables", async () => {
    mockInvoiceTotal.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockOverdueTotal.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    mockSql
      .mockResolvedValueOnce([{ total: "0.00" }]) // schedule
      .mockResolvedValueOnce([]) // rolling
      .mockResolvedValueOnce([
        { bank_total: "0.00", salaries_total: "0.00", vat_refund_total: "0.00" },
      ]) // monthly
      .mockResolvedValueOnce([{ total: "0.00" }]) // warehouse
      .mockResolvedValueOnce([]) // import
      // manual entries: one EUR receivable converted to PLN, one PLN payable
      .mockResolvedValueOnce([
        {
          id: 1,
          name: "EUR invoice",
          entry_type: "receivable",
          gross_value: "1000.00",
          currency: "EUR",
          gross_value_pln: "4320.00",
        },
        {
          id: 2,
          name: "PLN cost",
          entry_type: "payable",
          gross_value: "500.00",
          currency: "PLN",
          gross_value_pln: "500.00",
        },
      ]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/dashboard/summary?entity=all",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.manualReceivables).toHaveLength(1);
    expect(body.data.manualReceivables[0].grossValuePln).toBe(4320);
    expect(body.data.manualPayables).toHaveLength(1);
    expect(body.data.manualPayables[0].grossValuePln).toBe(500);
  });
});
