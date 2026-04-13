import { sql } from "./connection.js";

interface InvoiceGroup {
  contractorNip: string;
  contractorName: string;
  totalRemainingPln: number;
  invoices: Array<Record<string, unknown>>;
}

interface InvoiceQueryResult {
  groups: InvoiceGroup[];
  totalPln: number;
}

interface InvoiceFlatRow {
  id: number;
  entityCode: string;
  documentNumber: string;
  contractorName: string;
  contractorNip: string;
  paymentDue: string;
  currency: string;
  grossValue: number;
  remainingAmount: number;
  remainingAmountPln: number;
  daysUntilDue: number;
  isOverdue: boolean;
}

interface InvoiceSummary {
  totalPln: number;
  invoiceCount: number;
  contractorCount: number;
}

interface InvoiceListResult {
  summary: {
    all: InvoiceSummary;
    overdue: InvoiceSummary;
    inTerm: InvoiceSummary;
  };
  invoices: InvoiceFlatRow[];
}

/**
 * Converts remaining_amount to PLN using rate.
 */
export function toAmountPln(
  currency: string,
  remainingAmount: string | number,
  ratePln: string | number,
): number {
  const amount = Number(remainingAmount);
  const rate = Number(ratePln);
  return currency === "PLN" ? amount : amount * rate;
}

/**
 * Fetches invoices with exchange rate for a date range [dateFrom, dateTo).
 */
async function fetchInvoicesRange(
  documentType: "FS" | "FZ",
  entity: string,
  dateFrom: string,
  dateTo: string,
): Promise<Array<Record<string, unknown>>> {
  if (entity === "all") {
    return await sql`
      SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln
      FROM invoice i
      LEFT JOIN LATERAL (
        SELECT rate_pln FROM exchange_rate
        WHERE currency = i.currency
        ORDER BY rate_date DESC LIMIT 1
      ) er ON TRUE
      WHERE i.document_type = ${documentType}
        AND i.payment_due >= ${dateFrom}
        AND i.payment_due < ${dateTo}
      ORDER BY i.contractor_nip, i.payment_due
    `;
  }

  return await sql`
    SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln
    FROM invoice i
    LEFT JOIN LATERAL (
      SELECT rate_pln FROM exchange_rate
      WHERE currency = i.currency
      ORDER BY rate_date DESC LIMIT 1
    ) er ON TRUE
    WHERE i.document_type = ${documentType}
      AND i.entity_code = ${entity}
      AND i.payment_due >= ${dateFrom}
      AND i.payment_due < ${dateTo}
    ORDER BY i.contractor_nip, i.payment_due
  `;
}

/**
 * Fetches overdue invoices (payment_due < today).
 */
async function fetchInvoicesOverdue(
  documentType: "FS" | "FZ",
  entity: string,
  today: string,
): Promise<Array<Record<string, unknown>>> {
  if (entity === "all") {
    return await sql`
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

  return await sql`
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

/**
 * Groups invoice rows by contractor NIP, converting amounts to PLN.
 */
function groupByContractor(
  rows: Array<Record<string, unknown>>,
): InvoiceQueryResult {
  const groupMap = new Map<string, InvoiceGroup>();

  for (const row of rows) {
    const nip = (row.contractor_nip as string) || "BRAK-NIP";
    const remainingPln = toAmountPln(
      row.currency as string,
      row.remaining_amount as string,
      row.rate_pln as string,
    );

    if (!groupMap.has(nip)) {
      groupMap.set(nip, {
        contractorNip: nip,
        contractorName: row.contractor_name as string,
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
      remainingAmount: Number(row.remaining_amount as string),
      remainingAmountPln: remainingPln,
    });
  }

  const groups = Array.from(groupMap.values()).sort(
    (a, b) => b.totalRemainingPln - a.totalRemainingPln,
  );

  const totalPln = groups.reduce((sum, g) => sum + g.totalRemainingPln, 0);

  return { groups, totalPln };
}

/**
 * Query invoices by document type, entity, and period.
 * Shared by receivables and payables routes.
 */
export async function queryInvoices(
  documentType: "FS" | "FZ",
  entity: string,
  period: string,
): Promise<InvoiceQueryResult> {
  const today = new Date().toISOString().split("T")[0] as string;
  const in7 = new Date(Date.now() + 7 * 86400000)
    .toISOString()
    .split("T")[0] as string;
  const in30 = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .split("T")[0] as string;

  let rows: Array<Record<string, unknown>>;

  if (period === "7d") {
    rows = await fetchInvoicesRange(documentType, entity, today, in7);
  } else if (period === "30d") {
    rows = await fetchInvoicesRange(documentType, entity, in7, in30);
  } else {
    rows = await fetchInvoicesOverdue(documentType, entity, today);
  }

  return groupByContractor(rows);
}

/**
 * Fetches aggregated invoice SUM in PLN for dashboard summary.
 */
export async function queryInvoiceTotalPln(
  documentType: "FS" | "FZ",
  entity: string,
  dateFrom: string,
  dateTo: string,
  excludeNips: string[] = [],
): Promise<number> {
  const hasExclusions = excludeNips.length > 0;

  const [row] = entity === "all"
    ? hasExclusions
      ? await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = ${documentType}
            AND i.payment_due >= ${dateFrom}
            AND i.payment_due < ${dateTo}
            AND (i.contractor_nip IS NULL OR i.contractor_nip NOT IN ${sql(excludeNips)})
        `
      : await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = ${documentType}
            AND i.payment_due >= ${dateFrom}
            AND i.payment_due < ${dateTo}
        `
    : hasExclusions
      ? await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = ${documentType}
            AND i.payment_due >= ${dateFrom}
            AND i.payment_due < ${dateTo}
            AND i.entity_code = ${entity}
            AND (i.contractor_nip IS NULL OR i.contractor_nip NOT IN ${sql(excludeNips)})
        `
      : await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = ${documentType}
            AND i.payment_due >= ${dateFrom}
            AND i.payment_due < ${dateTo}
            AND i.entity_code = ${entity}
        `;

  return Number(row?.total ?? 0);
}

/**
 * Fetches overdue invoice SUM in PLN.
 */
export async function queryOverdueTotalPln(
  documentType: "FS" | "FZ",
  entity: string,
  today: string,
  excludeNips: string[] = [],
): Promise<number> {
  const hasExclusions = excludeNips.length > 0;

  const [row] = entity === "all"
    ? hasExclusions
      ? await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = ${documentType}
            AND i.payment_due < ${today}
            AND (i.contractor_nip IS NULL OR i.contractor_nip NOT IN ${sql(excludeNips)})
        `
      : await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = ${documentType}
            AND i.payment_due < ${today}
        `
    : hasExclusions
      ? await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = ${documentType}
            AND i.payment_due < ${today}
            AND i.entity_code = ${entity}
            AND (i.contractor_nip IS NULL OR i.contractor_nip NOT IN ${sql(excludeNips)})
        `
      : await sql`
          SELECT COALESCE(SUM(
            CASE WHEN i.currency = 'PLN' THEN i.remaining_amount
                 ELSE i.remaining_amount * COALESCE(er.rate_pln, 1)
            END
          ), 0) AS total
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = ${documentType}
            AND i.payment_due < ${today}
            AND i.entity_code = ${entity}
        `;

  return Number(row?.total ?? 0);
}

/**
 * Fetches all invoices for a document type + entity, with PLN conversion and days-until-due.
 * Returns flat list + pre-computed summary for cards.
 */
export async function queryAllInvoices(
  documentType: "FS" | "FZ",
  entity: string,
  excludeNips: string[] = [],
): Promise<InvoiceListResult> {
  const hasExclusions = excludeNips.length > 0;

  const rows = entity === "all"
    ? hasExclusions
      ? await sql`
          SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln,
            (i.payment_due - CURRENT_DATE) AS days_until_due
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = ${documentType}
            AND (i.contractor_nip IS NULL OR i.contractor_nip NOT IN ${sql(excludeNips)})
          ORDER BY i.payment_due
        `
      : await sql`
          SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln,
            (i.payment_due - CURRENT_DATE) AS days_until_due
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = ${documentType}
          ORDER BY i.payment_due
        `
    : hasExclusions
      ? await sql`
          SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln,
            (i.payment_due - CURRENT_DATE) AS days_until_due
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = ${documentType}
            AND i.entity_code = ${entity}
            AND (i.contractor_nip IS NULL OR i.contractor_nip NOT IN ${sql(excludeNips)})
          ORDER BY i.payment_due
        `
      : await sql`
          SELECT i.*, COALESCE(er.rate_pln, 1) AS rate_pln,
            (i.payment_due - CURRENT_DATE) AS days_until_due
          FROM invoice i
          LEFT JOIN LATERAL (
            SELECT rate_pln FROM exchange_rate
            WHERE currency = i.currency
            ORDER BY rate_date DESC LIMIT 1
          ) er ON TRUE
          WHERE i.document_type = ${documentType}
            AND i.entity_code = ${entity}
          ORDER BY i.payment_due
        `;

  const invoices: InvoiceFlatRow[] = [];
  const overdueNips = new Set<string>();
  const inTermNips = new Set<string>();
  const allNips = new Set<string>();
  let overduePln = 0;
  let inTermPln = 0;
  let overdueCount = 0;
  let inTermCount = 0;

  for (const row of rows) {
    const remainingPln = toAmountPln(
      row.currency as string,
      row.remaining_amount as string,
      row.rate_pln as string,
    );
    const daysUntilDue = Number(row.days_until_due);
    const isOverdue = daysUntilDue < 0;
    const nip = (row.contractor_nip as string) || "BRAK-NIP";

    allNips.add(nip);

    if (isOverdue) {
      overdueCount++;
      overduePln += remainingPln;
      overdueNips.add(nip);
    } else {
      inTermCount++;
      inTermPln += remainingPln;
      inTermNips.add(nip);
    }

    invoices.push({
      id: row.id as number,
      entityCode: row.entity_code as string,
      documentNumber: row.document_number as string,
      contractorName: row.contractor_name as string,
      contractorNip: nip,
      paymentDue: row.payment_due as string,
      currency: row.currency as string,
      grossValue: Number(row.gross_value),
      remainingAmount: Number(row.remaining_amount as string),
      remainingAmountPln: remainingPln,
      daysUntilDue,
      isOverdue,
    });
  }

  const totalPln = overduePln + inTermPln;

  return {
    summary: {
      all: {
        totalPln,
        invoiceCount: invoices.length,
        contractorCount: allNips.size,
      },
      overdue: {
        totalPln: overduePln,
        invoiceCount: overdueCount,
        contractorCount: overdueNips.size,
      },
      inTerm: {
        totalPln: inTermPln,
        invoiceCount: inTermCount,
        contractorCount: inTermNips.size,
      },
    },
    invoices,
  };
}
