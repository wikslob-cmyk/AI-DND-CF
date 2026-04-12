import type { FastifyInstance, FastifyReply } from "fastify";
import { sql } from "../db/connection.js";
import { authMiddleware } from "../auth/middleware.js";

export async function registerWarehouseRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  app.get("/api/warehouse", async (_request, reply: FastifyReply) => {
    const rows = await sql`
      SELECT
        id,
        article_name,
        quantity_component,
        quantity_finished,
        quantity_total,
        unit_price,
        value_component,
        value_finished,
        value_total
      FROM warehouse_item
      WHERE entity_code = 'dngro'
      ORDER BY article_name
    `;

    const items = rows.map((row) => ({
      id: row.id,
      articleName: row.article_name,
      quantityComponent: Number(row.quantity_component),
      quantityFinished: Number(row.quantity_finished),
      quantityTotal: Number(row.quantity_total),
      unitPrice: Number(row.unit_price),
      valueComponent: Number(row.value_component),
      valueFinished: Number(row.value_finished),
      valueTotal: Number(row.value_total),
    }));

    const totalValue = items.reduce(
      (sum, item) => sum + item.valueTotal,
      0,
    );

    return reply.send({
      data: {
        entityCode: "dngro",
        items,
        totalValue,
      },
    });
  });
}
