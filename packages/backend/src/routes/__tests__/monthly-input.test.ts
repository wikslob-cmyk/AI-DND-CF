import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";

// Mock DB connection
vi.mock("../../db/connection.js", () => {
  const mockSql = vi.fn();
  return { sql: mockSql };
});

import { sql } from "../../db/connection.js";
import { registerMonthlyInputRoutes } from "../monthly-input.js";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cookie);
  await app.register(jwt, { secret: "test-secret" });
  await registerMonthlyInputRoutes(app);
  return app;
}

function signToken(app: FastifyInstance): string {
  return app.jwt.sign({ authenticated: true });
}

describe("monthly-input routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
    mockSql.mockReset();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("PUT /api/monthly-input", () => {
    it("should upsert and return 200", async () => {
      const returnRow = {
        id: 1,
        entity_code: "cgesp",
        year: 2026,
        month: 4,
        vat_refund: "5000.00",
        salaries_net: "20000.00",
        bank_balance: "150000.00",
        updated_at: "2026-04-12T10:00:00Z",
      };
      mockSql.mockResolvedValueOnce([returnRow]);

      const token = signToken(app);
      const response = await app.inject({
        method: "PUT",
        url: "/api/monthly-input",
        headers: { cookie: `dashboard_token=${token}` },
        payload: {
          entityCode: "cgesp",
          year: 2026,
          month: 4,
          vatRefund: 5000,
          salariesNet: 20000,
          bankBalance: 150000,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.entityCode).toBe("cgesp");
      expect(body.data.vatRefund).toBe(5000);
      expect(body.data.salariesNet).toBe(20000);
      expect(body.data.bankBalance).toBe(150000);
    });

    it("should update on duplicate entity+month", async () => {
      const returnRow = {
        id: 1,
        entity_code: "cgesp",
        year: 2026,
        month: 4,
        vat_refund: "8000.00",
        salaries_net: "25000.00",
        bank_balance: "200000.00",
        updated_at: "2026-04-12T12:00:00Z",
      };
      mockSql.mockResolvedValueOnce([returnRow]);

      const token = signToken(app);
      const response = await app.inject({
        method: "PUT",
        url: "/api/monthly-input",
        headers: { cookie: `dashboard_token=${token}` },
        payload: {
          entityCode: "cgesp",
          year: 2026,
          month: 4,
          vatRefund: 8000,
          salariesNet: 25000,
          bankBalance: 200000,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.vatRefund).toBe(8000);
      expect(body.data.bankBalance).toBe(200000);
    });
  });

  describe("GET /api/monthly-input", () => {
    it("should return data for entity and month", async () => {
      const returnRow = {
        id: 1,
        entity_code: "dngro",
        year: 2026,
        month: 3,
        vat_refund: "3000.00",
        salaries_net: "15000.00",
        bank_balance: "80000.00",
        updated_at: "2026-03-15T10:00:00Z",
      };
      mockSql.mockResolvedValueOnce([returnRow]);

      const token = signToken(app);
      const response = await app.inject({
        method: "GET",
        url: "/api/monthly-input?entity=dngro&year=2026&month=3",
        headers: { cookie: `dashboard_token=${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.entityCode).toBe("dngro");
      expect(body.data.bankBalance).toBe(80000);
    });

    it("should return null when no data", async () => {
      mockSql.mockResolvedValueOnce([]);

      const token = signToken(app);
      const response = await app.inject({
        method: "GET",
        url: "/api/monthly-input?entity=cgesp&year=2025&month=1",
        headers: { cookie: `dashboard_token=${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toBeNull();
    });

    it("should return 400 when missing parameters", async () => {
      const token = signToken(app);
      const response = await app.inject({
        method: "GET",
        url: "/api/monthly-input?entity=cgesp",
        headers: { cookie: `dashboard_token=${token}` },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
