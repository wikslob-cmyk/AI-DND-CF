import type Anthropic from "@anthropic-ai/sdk";
import { sql } from "../db/connection.js";
import { queryInvoices, queryInvoiceTotalPln, queryOverdueTotalPln } from "../db/invoice-queries.js";
import { calculateCashflowProjection } from "../services/cashflow-projection.js";

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "get_receivables",
    description:
      "Pobiera naleznosci (faktury sprzedazowe FS) per podmiot lub dla calej grupy. Mozna filtrowac po okresie: 7d (najblizsze 7 dni), 30d (7-30 dni), overdue (przeterminowane).",
    input_schema: {
      type: "object" as const,
      properties: {
        entity: {
          type: "string",
          description:
            "Kod podmiotu (cgesp, dngro, dndsp, tdmsp, tdpsp) lub 'all' dla calej grupy",
          default: "all",
        },
        period: {
          type: "string",
          enum: ["7d", "30d", "overdue"],
          description: "Okres: 7d, 30d, lub overdue",
          default: "7d",
        },
      },
      required: [],
    },
  },
  {
    name: "get_payables",
    description:
      "Pobiera zobowiazania handlowe (faktury zakupowe FZ) per podmiot lub dla calej grupy.",
    input_schema: {
      type: "object" as const,
      properties: {
        entity: {
          type: "string",
          description: "Kod podmiotu lub 'all'",
          default: "all",
        },
        period: {
          type: "string",
          enum: ["7d", "30d", "overdue"],
          description: "Okres: 7d, 30d, lub overdue",
          default: "7d",
        },
      },
      required: [],
    },
  },
  {
    name: "get_overdue",
    description:
      "Pobiera przeterminowane naleznosci i zobowiazania handlowe. Zwraca osobno receivables i payables overdue.",
    input_schema: {
      type: "object" as const,
      properties: {
        entity: {
          type: "string",
          description: "Kod podmiotu lub 'all'",
          default: "all",
        },
      },
      required: [],
    },
  },
  {
    name: "get_liability_schedule",
    description:
      "Pobiera harmonogram zobowiazan finansowych (kredyty, leasingi, limity) na N miesiecy w przod.",
    input_schema: {
      type: "object" as const,
      properties: {
        entity: {
          type: "string",
          description: "Kod podmiotu lub 'all'",
          default: "all",
        },
        months: {
          type: "number",
          description: "Liczba miesiecy w przod (max 36)",
          default: 12,
        },
      },
      required: [],
    },
  },
  {
    name: "get_cashflow_projection",
    description:
      "Oblicza projekcje cashflow (plynnosci) grupy na N dni. Formula: saldo_start + wplywy - wyplywy. Zwraca poziom ryzyka.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Liczba dni projekcji (domyslnie 30)",
          default: 30,
        },
      },
      required: [],
    },
  },
  {
    name: "get_warehouse_value",
    description:
      "Pobiera stan i wartosc magazynu (tylko DND Group / dngro). Zwraca liste artykulow z ilosciami i wartosciami.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_entity_summary",
    description:
      "Pobiera podsumowanie finansowe podmiotu lub calej grupy: naleznosci 30d, zobowiazania 30d, zobowiazania finansowe, saldo bankowe, wartosc magazynu, przeterminowane.",
    input_schema: {
      type: "object" as const,
      properties: {
        entity: {
          type: "string",
          description: "Kod podmiotu lub 'all'",
          default: "all",
        },
      },
      required: [],
    },
  },
];

type ToolInput = Record<string, unknown>;

export async function executeTool(
  toolName: string,
  toolInput: ToolInput,
): Promise<string> {
  switch (toolName) {
    case "get_receivables":
      return executeGetReceivables(toolInput);
    case "get_payables":
      return executeGetPayables(toolInput);
    case "get_overdue":
      return executeGetOverdue(toolInput);
    case "get_liability_schedule":
      return executeGetLiabilitySchedule(toolInput);
    case "get_cashflow_projection":
      return executeGetCashflowProjection(toolInput);
    case "get_warehouse_value":
      return executeGetWarehouseValue();
    case "get_entity_summary":
      return executeGetEntitySummary(toolInput);
    default:
      return JSON.stringify({ error: `Nieznane narzedzie: ${toolName}` });
  }
}

async function executeGetReceivables(input: ToolInput): Promise<string> {
  const entity = (input.entity as string) || "all";
  const period = (input.period as string) || "7d";
  const result = await queryInvoices("FS", entity, period);
  return JSON.stringify({
    entity,
    period,
    totalPln: result.totalPln,
    groupCount: result.groups.length,
    groups: result.groups.map((g) => ({
      contractor: g.contractorName,
      nip: g.contractorNip,
      totalPln: g.totalRemainingPln,
      invoiceCount: g.invoices.length,
    })),
  });
}

async function executeGetPayables(input: ToolInput): Promise<string> {
  const entity = (input.entity as string) || "all";
  const period = (input.period as string) || "7d";
  const result = await queryInvoices("FZ", entity, period);
  return JSON.stringify({
    entity,
    period,
    totalPln: result.totalPln,
    groupCount: result.groups.length,
    groups: result.groups.map((g) => ({
      contractor: g.contractorName,
      nip: g.contractorNip,
      totalPln: g.totalRemainingPln,
      invoiceCount: g.invoices.length,
    })),
  });
}

async function executeGetOverdue(input: ToolInput): Promise<string> {
  const entity = (input.entity as string) || "all";
  const today = new Date().toISOString().split("T")[0] as string;

  const overdueReceivables = await queryOverdueTotalPln("FS", entity, today);
  const overduePayables = await queryOverdueTotalPln("FZ", entity, today);

  const receivablesDetail = await queryInvoices("FS", entity, "overdue");
  const payablesDetail = await queryInvoices("FZ", entity, "overdue");

  return JSON.stringify({
    entity,
    receivables: {
      totalPln: overdueReceivables,
      groupCount: receivablesDetail.groups.length,
      topContractors: receivablesDetail.groups.slice(0, 5).map((g) => ({
        contractor: g.contractorName,
        nip: g.contractorNip,
        totalPln: g.totalRemainingPln,
      })),
    },
    payables: {
      totalPln: overduePayables,
      groupCount: payablesDetail.groups.length,
      topContractors: payablesDetail.groups.slice(0, 5).map((g) => ({
        contractor: g.contractorName,
        nip: g.contractorNip,
        totalPln: g.totalRemainingPln,
      })),
    },
  });
}

async function executeGetLiabilitySchedule(
  input: ToolInput,
): Promise<string> {
  const entity = (input.entity as string) || "all";
  const months = Math.min(Number(input.months) || 12, 36);

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0] as string;
  const endDate = new Date(today);
  endDate.setMonth(endDate.getMonth() + months);
  const endDateStr = endDate.toISOString().split("T")[0] as string;

  const scheduleRows =
    entity === "all"
      ? await sql`
          SELECT ls.payment_date, ls.total, l.name, l.entity_code
          FROM liability_schedule ls
          JOIN liability l ON l.id = ls.liability_id
          WHERE ls.payment_date >= ${todayStr}
            AND ls.payment_date < ${endDateStr}
            AND l.status = 'active'
          ORDER BY ls.payment_date
        `
      : await sql`
          SELECT ls.payment_date, ls.total, l.name, l.entity_code
          FROM liability_schedule ls
          JOIN liability l ON l.id = ls.liability_id
          WHERE l.entity_code = ${entity}
            AND ls.payment_date >= ${todayStr}
            AND ls.payment_date < ${endDateStr}
            AND l.status = 'active'
          ORDER BY ls.payment_date
        `;

  const rollingRows =
    entity === "all"
      ? await sql`
          SELECT name, entity_code, config FROM liability
          WHERE type IN ('limit', 'factoring') AND status = 'active'
        `
      : await sql`
          SELECT name, entity_code, config FROM liability
          WHERE entity_code = ${entity}
            AND type IN ('limit', 'factoring') AND status = 'active'
        `;

  const totalScheduled = scheduleRows.reduce(
    (sum, r) => sum + Number(r.total),
    0,
  );

  let totalRolling = 0;
  const rollingDetails = rollingRows.map((r) => {
    const config = r.config as {
      monthly_capital?: number;
      monthly_interest?: number;
    };
    const monthly =
      (config.monthly_capital ?? 0) + (config.monthly_interest ?? 0);
    totalRolling += monthly * months;
    return {
      name: r.name,
      entityCode: r.entity_code,
      monthlyAmount: monthly,
    };
  });

  return JSON.stringify({
    entity,
    months,
    totalScheduledPln: totalScheduled,
    totalRollingPln: totalRolling,
    totalPln: totalScheduled + totalRolling,
    scheduleEntryCount: scheduleRows.length,
    rolling: rollingDetails,
  });
}

async function executeGetCashflowProjection(
  input: ToolInput,
): Promise<string> {
  const days = Math.min(Number(input.days) || 30, 90);
  const result = await calculateCashflowProjection(days);
  return JSON.stringify(result);
}

async function executeGetWarehouseValue(): Promise<string> {
  const rows = await sql`
    SELECT article_name, quantity_total, value_total
    FROM warehouse_item
    WHERE entity_code = 'dngro'
    ORDER BY value_total DESC
  `;

  const items = rows.map((r) => ({
    article: r.article_name,
    quantity: Number(r.quantity_total),
    valuePln: Number(r.value_total),
  }));

  const totalValue = items.reduce((sum, i) => sum + i.valuePln, 0);

  return JSON.stringify({
    entityCode: "dngro",
    totalValuePln: totalValue,
    itemCount: items.length,
    topItems: items.slice(0, 10),
  });
}

async function executeGetEntitySummary(input: ToolInput): Promise<string> {
  const entity = (input.entity as string) || "all";
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0] as string;
  const in30Str = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .split("T")[0] as string;

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const receivables30d = await queryInvoiceTotalPln(
    "FS",
    entity,
    todayStr,
    in30Str,
  );
  const payables30d = await queryInvoiceTotalPln(
    "FZ",
    entity,
    todayStr,
    in30Str,
  );
  const overdueReceivables = await queryOverdueTotalPln(
    "FS",
    entity,
    todayStr,
  );

  const [balanceRow] =
    entity === "all"
      ? await sql`
          SELECT COALESCE(SUM(bank_balance), 0) AS total
          FROM monthly_input
          WHERE year = ${currentYear} AND month = ${currentMonth}
        `
      : await sql`
          SELECT COALESCE(SUM(bank_balance), 0) AS total
          FROM monthly_input
          WHERE year = ${currentYear} AND month = ${currentMonth}
            AND entity_code = ${entity}
        `;

  let warehouseValue = 0;
  if (entity === "all" || entity === "dngro") {
    const [wRow] = await sql`
      SELECT COALESCE(SUM(value_total), 0) AS total
      FROM warehouse_item WHERE entity_code = 'dngro'
    `;
    warehouseValue = Number(wRow?.total ?? 0);
  }

  return JSON.stringify({
    entity,
    receivables30dPln: receivables30d,
    payables30dPln: payables30d,
    overdueReceivablesPln: overdueReceivables,
    bankBalancePln: Number(balanceRow?.total ?? 0),
    warehouseValuePln: warehouseValue,
  });
}
