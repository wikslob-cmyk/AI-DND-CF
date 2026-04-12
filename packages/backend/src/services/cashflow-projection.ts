import { sql } from "../db/connection.js";
import { queryInvoiceTotalPln } from "../db/invoice-queries.js";

type RiskLevel = "ok" | "warning" | "critical";

interface CashflowResult {
  saldoStart: number;
  wplywy30d: number;
  wyplywy30d: number;
  projekcja: number;
  riskLevel: RiskLevel;
  warnings: string[];
  details: {
    ratyHarmonogramow: number;
    rollingIng: number;
    zobowiazaniaHandlowe: number;
    wynagrodzenia: number;
    vat: number;
  };
}

/**
 * Calculates cashflow projection for the group.
 *
 * Formula: saldo_grupy_start + wplywy_30d - wyplywy_30d
 * where:
 * - saldo_start = SUM(bank_balance) from monthly_input (5 entities, current month)
 * - wplywy_30d = receivables [today, today+days), excluding overdue
 * - wyplywy_30d = schedule installments + rolling ING pro-rata + payables + salaries pro-rata + VAT
 */
export async function calculateCashflowProjection(
  days: number = 30,
): Promise<CashflowResult> {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0] as string;
  const endDate = new Date(Date.now() + days * 86400000);
  const endDateStr = endDate.toISOString().split("T")[0] as string;

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const warnings: string[] = [];

  // 1. saldo_start = SUM(bank_balance) from monthly_input, all 5 entities
  const [balanceRow] = await sql`
    SELECT COALESCE(SUM(bank_balance), 0) AS total,
           COUNT(*) AS entity_count
    FROM monthly_input
    WHERE year = ${currentYear} AND month = ${currentMonth}
  `;

  const saldoStart = Number(balanceRow?.total ?? 0);
  const entityCount = Number(balanceRow?.entity_count ?? 0);

  if (entityCount === 0) {
    warnings.push("Brak danych salda bankowego");
  } else if (entityCount < 5) {
    warnings.push(
      `Dane salda bankowego tylko dla ${entityCount} z 5 podmiotow`,
    );
  }

  // 2. wplywy_30d = receivables [today, today+days), NOT overdue
  const wplywy30d = await queryInvoiceTotalPln(
    "FS",
    "all",
    todayStr,
    endDateStr,
  );

  // 3. wyplywy_30d components
  // 3a. Schedule installments in [today, today+days)
  const [scheduleRow] = await sql`
    SELECT COALESCE(SUM(ls.total), 0) AS total
    FROM liability_schedule ls
    JOIN liability l ON l.id = ls.liability_id
    WHERE ls.payment_date >= ${todayStr}
      AND ls.payment_date < ${endDateStr}
      AND l.status = 'active'
  `;
  const ratyHarmonogramow = Number(scheduleRow?.total ?? 0);

  // 3b. Rolling ING pro-rata: (days/30) * monthly_amount
  const rollingRows = await sql`
    SELECT config FROM liability
    WHERE type IN ('limit', 'factoring') AND status = 'active'
  `;

  let rollingIng = 0;
  for (const r of rollingRows) {
    const config = (r.config ?? {}) as {
      monthly_capital?: number;
      monthly_interest?: number;
    };
    const monthlyTotal =
      (config.monthly_capital ?? 0) + (config.monthly_interest ?? 0);
    rollingIng += (days / 30) * monthlyTotal;
  }

  // 3c. Trade payables in [today, today+days)
  const zobowiazaniaHandlowe = await queryInvoiceTotalPln(
    "FZ",
    "all",
    todayStr,
    endDateStr,
  );

  // 3d. Salaries pro-rata from monthly_input
  const [salaryRow] = await sql`
    SELECT COALESCE(SUM(salaries_net), 0) AS total
    FROM monthly_input
    WHERE year = ${currentYear} AND month = ${currentMonth}
  `;
  const monthlySalaries = Number(salaryRow?.total ?? 0);
  const wynagrodzenia = (days / 30) * monthlySalaries;

  // 3e. VAT: 25th of next month, if within window
  let vat = 0;
  const nextMonth25 = new Date(currentYear, currentMonth, 25); // JS month is 0-indexed, so currentMonth = next month
  if (nextMonth25 >= today && nextMonth25 <= endDate) {
    const [vatRow] = await sql`
      SELECT COALESCE(SUM(vat_refund), 0) AS total
      FROM monthly_input
      WHERE year = ${currentYear} AND month = ${currentMonth}
    `;
    vat = Number(vatRow?.total ?? 0);
  }

  const wyplywy30d =
    ratyHarmonogramow +
    rollingIng +
    zobowiazaniaHandlowe +
    wynagrodzenia +
    vat;

  const projekcja = saldoStart + wplywy30d - wyplywy30d;

  // Risk assessment
  let riskLevel: RiskLevel = "ok";
  if (projekcja < 0) {
    riskLevel = "critical";
  } else if (wyplywy30d > 0 && projekcja < 0.15 * wyplywy30d) {
    riskLevel = "warning";
  }

  return {
    saldoStart,
    wplywy30d,
    wyplywy30d,
    projekcja,
    riskLevel,
    warnings,
    details: {
      ratyHarmonogramow,
      rollingIng,
      zobowiazaniaHandlowe,
      wynagrodzenia,
      vat,
    },
  };
}

export type { CashflowResult, RiskLevel };
