import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/connection.js", () => {
  const mockSql = vi.fn();
  return { sql: mockSql };
});

vi.mock("../../db/invoice-queries.js", () => ({
  queryInvoices: vi.fn(),
  queryInvoiceTotalPln: vi.fn(),
  queryOverdueTotalPln: vi.fn(),
  toAmountPln: vi.fn(),
}));

vi.mock("../../services/cashflow-projection.js", () => ({
  calculateCashflowProjection: vi.fn(),
}));

import { sql } from "../../db/connection.js";
import {
  queryInvoices,
  queryInvoiceTotalPln,
  queryOverdueTotalPln,
} from "../../db/invoice-queries.js";
import { calculateCashflowProjection } from "../../services/cashflow-projection.js";
import { executeTool, TOOL_DEFINITIONS } from "../tools.js";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockQueryInvoices = queryInvoices as ReturnType<typeof vi.fn>;
const mockQueryInvoiceTotalPln = queryInvoiceTotalPln as ReturnType<typeof vi.fn>;
const mockQueryOverdueTotalPln = queryOverdueTotalPln as ReturnType<typeof vi.fn>;
const mockCalculateCashflow = calculateCashflowProjection as ReturnType<typeof vi.fn>;

describe("Viktor tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("TOOL_DEFINITIONS", () => {
    it("defines exactly 7 tools", () => {
      expect(TOOL_DEFINITIONS).toHaveLength(7);
    });

    it("includes all expected tool names", () => {
      const names = TOOL_DEFINITIONS.map((t) => t.name);
      expect(names).toContain("get_receivables");
      expect(names).toContain("get_payables");
      expect(names).toContain("get_overdue");
      expect(names).toContain("get_liability_schedule");
      expect(names).toContain("get_cashflow_projection");
      expect(names).toContain("get_warehouse_value");
      expect(names).toContain("get_entity_summary");
    });
  });

  describe("get_receivables", () => {
    it("returns receivables data from DB", async () => {
      mockQueryInvoices.mockResolvedValueOnce({
        totalPln: 50000,
        groups: [
          {
            contractorNip: "1234567890",
            contractorName: "Firma A",
            totalRemainingPln: 30000,
            invoices: [{ id: 1 }, { id: 2 }],
          },
          {
            contractorNip: "0987654321",
            contractorName: "Firma B",
            totalRemainingPln: 20000,
            invoices: [{ id: 3 }],
          },
        ],
      });

      const result = JSON.parse(
        await executeTool("get_receivables", { entity: "cgesp", period: "7d" }),
      );

      expect(result.entity).toBe("cgesp");
      expect(result.period).toBe("7d");
      expect(result.totalPln).toBe(50000);
      expect(result.groupCount).toBe(2);
      expect(result.groups[0].contractor).toBe("Firma A");
      expect(mockQueryInvoices).toHaveBeenCalledWith("FS", "cgesp", "7d");
    });
  });

  describe("get_overdue", () => {
    it("returns overdue receivables and payables", async () => {
      mockQueryOverdueTotalPln
        .mockResolvedValueOnce(15000) // receivables
        .mockResolvedValueOnce(8000); // payables

      mockQueryInvoices
        .mockResolvedValueOnce({
          totalPln: 15000,
          groups: [
            {
              contractorNip: "1111111111",
              contractorName: "Dluznik",
              totalRemainingPln: 15000,
              invoices: [{ id: 1 }],
            },
          ],
        })
        .mockResolvedValueOnce({
          totalPln: 8000,
          groups: [],
        });

      const result = JSON.parse(
        await executeTool("get_overdue", { entity: "all" }),
      );

      expect(result.receivables.totalPln).toBe(15000);
      expect(result.payables.totalPln).toBe(8000);
      expect(result.receivables.topContractors).toHaveLength(1);
      expect(result.receivables.topContractors[0].contractor).toBe("Dluznik");
    });
  });

  describe("get_liability_schedule", () => {
    it("returns schedule data with rolling entries", async () => {
      mockSql
        .mockResolvedValueOnce([
          {
            payment_date: "2026-05-01",
            total: "5000.00",
            name: "Alior Bank",
            entity_code: "cgesp",
          },
        ])
        .mockResolvedValueOnce([
          {
            name: "ING Limit",
            entity_code: "dngro",
            config: { monthly_capital: 70000, monthly_interest: 18000 },
          },
        ]);

      const result = JSON.parse(
        await executeTool("get_liability_schedule", {
          entity: "all",
          months: 3,
        }),
      );

      expect(result.totalScheduledPln).toBe(5000);
      expect(result.rolling[0].monthlyAmount).toBe(88000);
      expect(result.totalRollingPln).toBe(88000 * 3);
    });
  });

  describe("get_cashflow_projection", () => {
    it("delegates to calculateCashflowProjection", async () => {
      const mockResult = {
        saldoStart: 500000,
        wplywy30d: 200000,
        wyplywy30d: 150000,
        projekcja: 550000,
        riskLevel: "ok",
        warnings: [],
        details: {
          ratyHarmonogramow: 50000,
          rollingIng: 30000,
          zobowiazaniaHandlowe: 40000,
          wynagrodzenia: 20000,
          vat: 10000,
        },
      };

      mockCalculateCashflow.mockResolvedValueOnce(mockResult);

      const result = JSON.parse(
        await executeTool("get_cashflow_projection", { days: 30 }),
      );

      expect(result.projekcja).toBe(550000);
      expect(result.riskLevel).toBe("ok");
      expect(mockCalculateCashflow).toHaveBeenCalledWith(30);
    });
  });

  describe("get_warehouse_value", () => {
    it("returns warehouse data for dngro", async () => {
      mockSql.mockResolvedValueOnce([
        {
          article_name: "Produkt A",
          quantity_total: "100",
          value_total: "50000.00",
        },
        {
          article_name: "Produkt B",
          quantity_total: "50",
          value_total: "25000.00",
        },
      ]);

      const result = JSON.parse(await executeTool("get_warehouse_value", {}));

      expect(result.entityCode).toBe("dngro");
      expect(result.totalValuePln).toBe(75000);
      expect(result.itemCount).toBe(2);
    });
  });

  describe("get_entity_summary", () => {
    it("returns summary with all financial data", async () => {
      mockQueryInvoiceTotalPln
        .mockResolvedValueOnce(100000) // receivables
        .mockResolvedValueOnce(60000); // payables
      mockQueryOverdueTotalPln.mockResolvedValueOnce(20000);

      mockSql
        .mockResolvedValueOnce([{ total: "300000", entity_count: "5" }]) // balance
        .mockResolvedValueOnce([{ total: "80000" }]); // warehouse

      const result = JSON.parse(
        await executeTool("get_entity_summary", { entity: "all" }),
      );

      expect(result.receivables30dPln).toBe(100000);
      expect(result.payables30dPln).toBe(60000);
      expect(result.overdueReceivablesPln).toBe(20000);
      expect(result.bankBalancePln).toBe(300000);
      expect(result.warehouseValuePln).toBe(80000);
    });
  });

  describe("tool error handling", () => {
    it("returns error for unknown tool", async () => {
      const result = JSON.parse(
        await executeTool("nonexistent_tool", {}),
      );

      expect(result.error).toContain("Nieznane narzedzie");
    });
  });
});

describe("system-prompt", () => {
  it("contains context of 5 entities", async () => {
    const { SYSTEM_PROMPT } = await import("../system-prompt.js");

    expect(SYSTEM_PROMPT).toContain("cgesp");
    expect(SYSTEM_PROMPT).toContain("dngro");
    expect(SYSTEM_PROMPT).toContain("dndsp");
    expect(SYSTEM_PROMPT).toContain("tdmsp");
    expect(SYSTEM_PROMPT).toContain("tdpsp");
    expect(SYSTEM_PROMPT).toContain("Viktor");
    expect(SYSTEM_PROMPT).toContain("po polsku");
  });
});
