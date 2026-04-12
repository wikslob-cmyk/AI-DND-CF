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
import { registerReceivablesRoutes } from "../receivables.js";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cookie);
  await app.register(jwt, { secret: "test-secret" });
  await registerReceivablesRoutes(app);
  return app;
}

function signToken(app: FastifyInstance): string {
  return app.jwt.sign({ authenticated: true });
}

const TODAY = new Date().toISOString().split("T")[0];
const IN_3_DAYS = new Date(Date.now() + 3 * 86400000)
  .toISOString()
  .split("T")[0];
const YESTERDAY = new Date(Date.now() - 86400000)
  .toISOString()
  .split("T")[0];

describe("receivables routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
    mockSql.mockReset();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET receivables?entity=all&period=7d returns receivables within 7 days", async () => {
    mockSql.mockResolvedValueOnce([
      {
        id: 1,
        entity_code: "cgesp",
        document_number: "FS/001",
        document_type: "FS",
        contractor_name: "Firma A",
        contractor_nip: "1234567890",
        payment_due: IN_3_DAYS,
        currency: "PLN",
        gross_value: "10000.00",
        remaining_amount: "5000.00",
        rate_pln: "1",
      },
    ]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/receivables?entity=all&period=7d",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.groups).toHaveLength(1);
    expect(body.data.groups[0].contractorNip).toBe("1234567890");
    expect(body.data.totalPln).toBe(5000);
  });

  it("GET receivables?entity=cgesp&period=overdue returns only overdue CGE", async () => {
    mockSql.mockResolvedValueOnce([
      {
        id: 2,
        entity_code: "cgesp",
        document_number: "FS/002",
        document_type: "FS",
        contractor_name: "Firma B",
        contractor_nip: "9876543210",
        payment_due: YESTERDAY,
        currency: "PLN",
        gross_value: "8000.00",
        remaining_amount: "8000.00",
        rate_pln: "1",
      },
    ]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/receivables?entity=cgesp&period=overdue",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.entity).toBe("cgesp");
    expect(body.data.period).toBe("overdue");
    expect(body.data.totalPln).toBe(8000);
  });

  it("EUR invoice is converted to PLN using exchange rate", async () => {
    mockSql.mockResolvedValueOnce([
      {
        id: 3,
        entity_code: "dngro",
        document_number: "FS/003",
        document_type: "FS",
        contractor_name: "EU Corp",
        contractor_nip: "DE123456789",
        payment_due: IN_3_DAYS,
        currency: "EUR",
        gross_value: "1000.00",
        remaining_amount: "1000.00",
        rate_pln: "4.3200",
      },
    ]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/receivables?entity=all&period=7d",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.totalPln).toBeCloseTo(4320, 0);
    expect(body.data.groups[0].invoices[0].remainingAmountPln).toBeCloseTo(
      4320,
      0,
    );
  });

  it("returns 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/receivables?entity=all&period=7d",
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 400 for invalid entity param", async () => {
    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/receivables?entity=invalid_entity&period=7d",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("aggregates same NIP from multiple entities into one group", async () => {
    const sharedNip = "5555555555";
    mockSql.mockResolvedValueOnce([
      {
        id: 10,
        entity_code: "cgesp",
        document_number: "FS/010",
        document_type: "FS",
        contractor_name: "Shared Client",
        contractor_nip: sharedNip,
        payment_due: IN_3_DAYS,
        currency: "PLN",
        gross_value: "3000.00",
        remaining_amount: "3000.00",
        rate_pln: "1",
      },
      {
        id: 11,
        entity_code: "dngro",
        document_number: "FS/011",
        document_type: "FS",
        contractor_name: "Shared Client",
        contractor_nip: sharedNip,
        payment_due: IN_3_DAYS,
        currency: "PLN",
        gross_value: "2000.00",
        remaining_amount: "2000.00",
        rate_pln: "1",
      },
    ]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/receivables?entity=all&period=7d",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    // Same NIP should be in 1 group
    expect(body.data.groups).toHaveLength(1);
    expect(body.data.groups[0].invoices).toHaveLength(2);
    expect(body.data.groups[0].totalRemainingPln).toBe(5000);
  });
});
