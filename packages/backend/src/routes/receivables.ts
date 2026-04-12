import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sql } from "../db/connection.js";
import { authMiddleware } from "../auth/middleware.js";

interface InvoiceQuery {
  entity?: string;
  period?: string;
}

async function queryInvoices(
  documentType: "FS" | "FZ",
  entity: string,
  period: string,
): Promise<{ groups: Array<{ contractorNip: string; contractorName: string; totalRemainingPln: number; invoices: Array<Record<string, unknown>> }>; totalPln: number }> {
  const today = new Date().toISOString().split("T")[0] as string;
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0] as string;
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0] as string;

  let rows;

  if (entity === "all") {
    if (period === "7d") {
      rows = await sql`
        SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln
        FROM invoice i
        LEFT JOIN LATERAL (
          SELECT rate_pln FROM exchange_rate
          WHERE currency = i.currency
          ORDER BY rate_date DESC LIMIT 1
        ) er ON TRUE
        WHERE i.document_type = ${documentType}
          AND i.payment_due >= ${today}
          AND i.payment_due < ${in7}
        ORDER BY i.contractor_nip, i.payment_due
      `;
    } else if (period === "30d") {
      rows = await sql`
        SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln
        FROM invoice i
        LEFT JOIN LATERAL (
          SELECT rate_pln FROM exchange_rate
          WHERE currency = i.currency
          ORDER BY rate_date DESC LIMIT 1
        ) er ON TRUE
        WHERE i.document_type = ${documentType}
          AND i.payment_due >= ${in7}
          AND i.payment_due < ${in30}
        ORDER BY i.contractor_nip, i.payment_due
      `;
    } else {
      rows = await sql`
        SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln
        FROM invoice i
        LEFT JOIN LATERAL (
          SELECT rate_pln FROM exchange_rate
          WHERE currency = i.currency
          ORDER BY rate_date DESC LIMIT 1
        ) er ON TRUE
        WHERE i.document_type = ${documentType}
          AND i.payment_due < ${today}
        ORDER BY i.contractor_nip, i.payment_due
      `;
    }
  } else {
    if (period === "7d") {
      rows = await sql`
        SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln
        FROM invoice i
        LEFT JOIN LATERAL (
          SELECT rate_pln FROM exchange_rate
          WHERE currency = i.currency
          ORDER BY rate_date DESC LIMIT 1
        ) er ON TRUE
        WHERE i.document_type = ${documentType}
          AND i.entity_code = ${entity}
          AND i.payment_due >= ${today}
          AND i.payment_due < ${in7}
        ORDER BY i.contractor_nip, i.payment_due
      `;
    } else if (period === "30d") {
      rows = await sql`
        SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln
        FROM invoice i
        LEFT JOIN LATERAL (
          SELECT rate_pln FROM exchange_rate
          WHERE currency = i.currency
          ORDER BY rate_date DESC LIMIT 1
        ) er ON TRUE
        WHERE i.document_type = ${documentType}
          AND i.entity_code = ${entity}
          AND i.payment_due >= ${in7}
          AND i.payment_due < ${in30}
        ORDER BY i.contractor_nip, i.payment_due
      `;
    } else {
      rows = await sql`
        SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln
        FROM invoice i
        LEFT JOIN LATERAL (
          SELECT rate_pln FROM exchange_rate
          WHERE currency = i.currency
          ORDER BY rate_date DESC LIMIT 1
        ) er ON TRUE
        WHERE i.document_type = ${documentType}
          AND i.entity_code = ${entity}
          AND i.payment_due < ${today}
        ORDER BY i.contractor_nip, i.payment_due
      `;
    }
  }

  const groupMap = new Map<
    string,
    {
      contractorNip: string;
      contractorName: string;
      totalRemainingPln: number;
      invoices: Array<Record<string, unknown>>;
    }
  >();

  for (const row of rows) {
    const nip = row.contractor_nip || "BRAK-NIP";
    const ratePln = Number(row.rate_pln);
    const remainingPln =
      row.currency === "PLN"
        ? Number(row.remaining_amount)
        : Number(row.remaining_amount) * ratePln;

    if (!groupMap.has(nip)) {
      groupMap.set(nip, {
        contractorNip: nip,
        contractorName: row.contractor_name,
        totalRemainingPln: 0,
        invoices: [],
      });
    }

    const group = groupMap.get(nip)!;
    group.totalRemainingPln += remainingPln;
    group.invoices.push({
      id: row.id,
      entityCode: row.entity_code,
      documentNumber: row.document_number,
      documentType: row.document_type,
      contractorName: row.contractor_name,
      contractorNip: row.contractor_nip,
      paymentDue: row.payment_due,
      currency: row.currency,
      grossValue: Number(row.gross_value),
      remainingAmount: Number(row.remaining_amount),
      remainingAmountPln: remainingPln,
    });
  }

  const groups = Array.from(groupMap.values()).sort(
    (a, b) => b.totalRemainingPln - a.totalRemainingPln,
  );

  const totalPln = groups.reduce((sum, g) => sum + g.totalRemainingPln, 0);

  return { groups, totalPln };
}

export async function registerReceivablesRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  app.get(
    "/api/receivables",
    async (
      request: FastifyRequest<{ Querystring: InvoiceQuery }>,
      reply: FastifyReply,
    ) => {
      const entity = request.query.entity || "all";
      const period = request.query.period || "7d";

      const result = await queryInvoices("FS", entity, period);

      return reply.send({
        data: {
          entity,
          period,
          ...result,
        },
      });
    },
  );
}

export { queryInvoices };
