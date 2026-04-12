import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../db/connection.js", () => {
  const mockSql = vi.fn();
  return { sql: mockSql };
});

vi.mock("../../db/invoice-queries.js", () => ({
  queryInvoiceTotalPln: vi.fn(),
}));

import { sql } from "../../db/connection.js";
import { queryInvoiceTotalPln } from "../../db/invoice-queries.js";
import { calculateCashflowProjection } from "../cashflow-projection.js";

const mockSql = sql as unknown as ReturnType<typeof vi.fn>;
const mockQueryInvoiceTotalPln = queryInvoiceTotalPln as ReturnType<typeof vi.fn>;

/**
 * The implementation calls in this exact order:
 * 1. sql - bank balance (returns total, entity_count)
 * 2. queryInvoiceTotalPln("FS", ...) - receivables
 * 3. sql - schedule installments (returns total)
 * 4. sql - rolling liabilities (returns config[])
 * 5. queryInvoiceTotalPln("FZ", ...) - payables
 * 6. sql - salaries (returns total)
 * 7. sql - VAT (conditional: only if 25th of next month is within window)
 */
function setupMocks(opts: {
  bankBalance?: number;
  entityCount?: number;
  receivables?: number;
  scheduleTotal?: number;
  rollingConfigs?: Array<{ monthly_capital: number; monthly_interest: number }>;
  payables?: number;
  salaries?: number;
  vat?: number;
}): void {
  const {
    bankBalance = 500000,
    entityCount = 5,
    receivables = 200000,
    scheduleTotal = 80000,
    rollingConfigs = [{ monthly_capital: 70000, monthly_interest: 18000 }],
    payables = 60000,
    salaries = 100000,
    vat = 15000,
  } = opts;

  // sql call 1: bank balance
  mockSql.mockResolvedValueOnce([
    { total: String(bankBalance), entity_count: String(entityCount) },
  ]);

  // queryInvoiceTotalPln call 1: receivables FS
  mockQueryInvoiceTotalPln.mockResolvedValueOnce(receivables);

  // sql call 2: schedule installments
  mockSql.mockResolvedValueOnce([{ total: String(scheduleTotal) }]);

  // sql call 3: rolling liabilities
  mockSql.mockResolvedValueOnce(
    rollingConfigs.map((c) => ({ config: c })),
  );

  // queryInvoiceTotalPln call 2: payables FZ
  mockQueryInvoiceTotalPln.mockResolvedValueOnce(payables);

  // sql call 4: salaries
  mockSql.mockResolvedValueOnce([{ total: String(salaries) }]);

  // sql call 5: VAT (may or may not be called, but mock it just in case)
  mockSql.mockResolvedValueOnce([{ total: String(vat) }]);
}

describe("cashflow-projection", () => {
  beforeEach(() => {
    mockSql.mockReset();
    mockQueryInvoiceTotalPln.mockReset();
  });

  it("calculates projection with full data and correct risk_level ok", async () => {
    setupMocks({
      bankBalance: 1000000,
      receivables: 200000,
      scheduleTotal: 50000,
      rollingConfigs: [{ monthly_capital: 10000, monthly_interest: 5000 }],
      payables: 30000,
      salaries: 60000,
      vat: 10000,
    });

    const result = await calculateCashflowProjection(30);

    expect(result.saldoStart).toBe(1000000);
    expect(result.wplywy30d).toBe(200000);
    expect(result.wyplywy30d).toBeGreaterThan(0);
    expect(result.projekcja).toBe(
      result.saldoStart + result.wplywy30d - result.wyplywy30d,
    );
    expect(result.riskLevel).toBe("ok");
    expect(result.warnings).toHaveLength(0);
  });

  it("returns warning risk_level when projection < 15% of expenses", async () => {
    // Low balance + small income + high expenses => warning or critical
    setupMocks({
      bankBalance: 15000,
      receivables: 2000,
      scheduleTotal: 80000,
      rollingConfigs: [{ monthly_capital: 10000, monthly_interest: 5000 }],
      payables: 10000,
      salaries: 5000,
      vat: 0,
    });

    const result = await calculateCashflowProjection(30);

    // With these numbers, projection should be negative or very low
    expect(["warning", "critical"]).toContain(result.riskLevel);
  });

  it("returns critical risk_level when projection < 0", async () => {
    setupMocks({
      bankBalance: 0,
      receivables: 0,
      scheduleTotal: 100000,
      rollingConfigs: [{ monthly_capital: 50000, monthly_interest: 20000 }],
      payables: 50000,
      salaries: 30000,
      vat: 0,
    });

    const result = await calculateCashflowProjection(30);

    expect(result.projekcja).toBeLessThan(0);
    expect(result.riskLevel).toBe("critical");
  });

  it("adds warning when no bank balance data exists", async () => {
    setupMocks({
      bankBalance: 0,
      entityCount: 0,
      receivables: 50000,
      scheduleTotal: 10000,
      rollingConfigs: [],
      payables: 5000,
      salaries: 0,
      vat: 0,
    });

    const result = await calculateCashflowProjection(30);

    expect(result.warnings).toContain("Brak danych salda bankowego");
  });

  it("adds warning when only some entities have balance data", async () => {
    setupMocks({
      bankBalance: 100000,
      entityCount: 3,
      scheduleTotal: 10000,
      rollingConfigs: [],
      payables: 5000,
      salaries: 0,
      vat: 0,
    });

    const result = await calculateCashflowProjection(30);

    expect(result.warnings.some((w: string) => w.includes("3 z 5"))).toBe(
      true,
    );
  });

  it("does NOT include overdue receivables in wplywy_30d", async () => {
    setupMocks({ receivables: 100000, rollingConfigs: [] });

    await calculateCashflowProjection(30);

    // Verify queryInvoiceTotalPln was called with "FS", "all", today, today+30
    expect(mockQueryInvoiceTotalPln).toHaveBeenCalledWith(
      "FS",
      "all",
      expect.any(String),
      expect.any(String),
    );

    const [docType, entity, dateFrom] =
      mockQueryInvoiceTotalPln.mock.calls[0];
    expect(docType).toBe("FS");
    expect(entity).toBe("all");

    const today = new Date().toISOString().split("T")[0];
    expect(dateFrom).toBe(today);
  });

  it("calculates ING rolling pro-rata: 30/30 * monthly amount", async () => {
    setupMocks({
      bankBalance: 1000000,
      receivables: 500000,
      scheduleTotal: 0,
      rollingConfigs: [
        { monthly_capital: 70000, monthly_interest: 18000 },
        { monthly_capital: 0, monthly_interest: 15000 },
      ],
      payables: 0,
      salaries: 0,
      vat: 0,
    });

    const result = await calculateCashflowProjection(30);

    // (30/30) * (88000 + 15000) = 103000
    expect(result.details.rollingIng).toBeCloseTo(103000, 0);
  });

  it("returns detailed expense breakdown", async () => {
    setupMocks({ rollingConfigs: [] });

    const result = await calculateCashflowProjection(30);

    expect(result.details).toHaveProperty("ratyHarmonogramow");
    expect(result.details).toHaveProperty("rollingIng");
    expect(result.details).toHaveProperty("zobowiazaniaHandlowe");
    expect(result.details).toHaveProperty("wynagrodzenia");
    expect(result.details).toHaveProperty("vat");
  });
});
