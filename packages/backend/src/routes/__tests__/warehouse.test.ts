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
import { registerWarehouseRoutes } from "../warehouse.js";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(cookie);
  await app.register(jwt, { secret: "test-secret" });
  await registerWarehouseRoutes(app);
  return app;
}

function signToken(app: FastifyInstance): string {
  return app.jwt.sign({ authenticated: true });
}

describe("warehouse routes", () => {
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
      url: "/api/warehouse",
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns 400 for invalid entity param", async () => {
    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/warehouse?entity=invalid",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET warehouse returns items with quantities, values and total", async () => {
    mockSql.mockResolvedValueOnce([
      {
        id: 1,
        article_name: "Widget A",
        quantity_component: "10.000",
        quantity_finished: "5.000",
        quantity_total: "15.000",
        unit_price: "100.00",
        value_component: "1000.00",
        value_finished: "500.00",
        value_total: "1500.00",
      },
      {
        id: 2,
        article_name: "Widget B",
        quantity_component: "0.000",
        quantity_finished: "20.000",
        quantity_total: "20.000",
        unit_price: "200.00",
        value_component: "0.00",
        value_finished: "4000.00",
        value_total: "4000.00",
      },
    ]);

    const token = signToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/warehouse",
      headers: { cookie: `dashboard_token=${token}` },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.entityCode).toBe("dngro");
    expect(body.data.items).toHaveLength(2);
    expect(body.data.totalValue).toBe(5500);
    expect(body.data.items[0].articleName).toBe("Widget A");
    expect(body.data.items[0].quantityTotal).toBe(15);
  });
});
