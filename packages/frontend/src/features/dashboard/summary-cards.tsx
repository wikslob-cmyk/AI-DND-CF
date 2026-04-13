import { type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ManualEntry {
  id: number;
  name: string;
  grossValue: number;
  grossValuePln: number;
  currency: string;
}

interface SummaryData {
  receivablesTotal: number;
  overdueReceivables: number;
  payablesTotal: number;
  overduePayables: number;
  liabilities30d: number;
  bankBalance: number;
  salaries: number;
  vatRefund: number;
  warehouseValue: number;
  manualReceivables: ManualEntry[];
  manualPayables: ManualEntry[];
  lastImport: { importedAt: string; status: string } | null;
}

interface SummaryCardsProps {
  data: SummaryData;
}

function computeTotals(data: SummaryData) {
  const manualReceivablesSum = data.manualReceivables.reduce(
    (sum, e) => sum + e.grossValuePln,
    0,
  );
  const manualPayablesSum = data.manualPayables.reduce(
    (sum, e) => sum + e.grossValuePln,
    0,
  );
  const totalAssets =
    data.receivablesTotal +
    data.bankBalance +
    data.vatRefund +
    data.warehouseValue +
    manualReceivablesSum;
  const totalLiabilities =
    data.payablesTotal +
    data.liabilities30d +
    data.salaries +
    manualPayablesSum;
  const netPosition = totalAssets - totalLiabilities;
  return { totalAssets, totalLiabilities, netPosition };
}

function TableRow({
  label,
  amount,
  currency,
  color,
  navigateTo,
  subtitle,
  subtitleAmount,
  isBold,
}: {
  label: string;
  amount: number;
  currency?: string;
  color?: string;
  navigateTo?: string;
  subtitle?: string;
  subtitleAmount?: number;
  isBold?: boolean;
}): ReactNode {
  const navigate = useNavigate();

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${navigateTo ? "cursor-pointer hover:bg-gray-50" : ""} ${isBold ? "bg-gray-50" : ""}`}
      onClick={() => navigateTo && navigate(navigateTo)}
    >
      {color && <div className={`w-2 h-8 rounded-full ${color}`} />}
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm ${isBold ? "font-bold text-gray-900" : "text-gray-700"}`}
        >
          {label}
        </span>
        {subtitleAmount !== undefined && subtitleAmount > 0 && (
          <p className="text-xs text-red-500">
            przeterminowane: {formatCurrency(subtitleAmount)}
          </p>
        )}
        {subtitle && subtitleAmount === undefined && (
          <p className="text-xs text-gray-500">{subtitle}</p>
        )}
      </div>
      <span
        className={`text-right whitespace-nowrap ${isBold ? "text-lg font-bold" : "text-base font-semibold"}`}
      >
        {formatCurrency(amount, currency)}
      </span>
    </div>
  );
}

function formatImportDate(importedAt: string): string {
  return new Date(importedAt).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function SummaryCards({ data }: SummaryCardsProps): ReactNode {
  const { totalAssets, totalLiabilities, netPosition } = computeTotals(data);
  const balanceDate = data.lastImport
    ? formatImportDate(data.lastImport.importedAt)
    : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* AKTYWA */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-700">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            Aktywa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pt-3">
          <TableRow
            label="Naleznosci"
            amount={data.receivablesTotal}
            color="bg-emerald-400"
            navigateTo="/dashboard/receivables"
            subtitle="w tym przeterminowane"
            subtitleAmount={data.overdueReceivables}
          />
          <TableRow
            label="Saldo bankowe"
            amount={data.bankBalance}
            color="bg-blue-400"
            navigateTo="/dashboard/monthly-input"
          />
          <TableRow
            label="Zwroty VAT"
            amount={data.vatRefund}
            color="bg-cyan-400"
            navigateTo="/dashboard/monthly-input"
          />
          {data.warehouseValue > 0 && (
            <TableRow
              label="Wartosc magazynu"
              amount={data.warehouseValue}
              color="bg-purple-400"
              navigateTo="/dashboard/warehouse"
            />
          )}
          {data.manualReceivables.map((entry) => (
            <TableRow
              key={entry.id}
              label={entry.name}
              amount={entry.grossValuePln}
              subtitle={entry.currency !== "PLN" ? `${formatCurrency(entry.grossValue, entry.currency)}` : undefined}
              color="bg-teal-400"
            />
          ))}
          <div className="border-t mt-2 pt-1">
            <TableRow label="Razem aktywa" amount={totalAssets} isBold />
          </div>
        </CardContent>
      </Card>

      {/* ZOBOWIAZANIA */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-red-700">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            Zobowiazania
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pt-3">
          <TableRow
            label="Zobowiazania handlowe"
            amount={data.payablesTotal}
            color="bg-orange-400"
            navigateTo="/dashboard/payables"
            subtitle="w tym przeterminowane"
            subtitleAmount={data.overduePayables}
          />
          <TableRow
            label="Zobowiazania finansowe (30 dni)"
            amount={data.liabilities30d}
            color="bg-red-400"
            navigateTo="/dashboard/liabilities"
          />
          <TableRow
            label="Wynagrodzenia"
            amount={data.salaries}
            color="bg-amber-400"
            navigateTo="/dashboard/monthly-input"
          />
          {data.manualPayables.map((entry) => (
            <TableRow
              key={entry.id}
              label={entry.name}
              amount={entry.grossValuePln}
              subtitle={entry.currency !== "PLN" ? `${formatCurrency(entry.grossValue, entry.currency)}` : undefined}
              color="bg-rose-400"
            />
          ))}
          <div className="border-t mt-2 pt-1">
            <TableRow
              label="Razem zobowiazania"
              amount={totalLiabilities}
              isBold
            />
          </div>
        </CardContent>
      </Card>

      {/* BILANS */}
      <div className="lg:col-span-2">
        <Card
          className={`border-2 ${netPosition >= 0 ? "border-emerald-300 bg-emerald-50/50" : "border-red-300 bg-red-50/50"}`}
        >
          <CardContent className="flex items-center justify-between py-4">
            <span className="text-sm font-semibold uppercase tracking-wider text-gray-600">
              {balanceDate
                ? `Bilans na dzien ${balanceDate}`
                : "Bilans"}
            </span>
            <span
              className={`text-2xl font-bold ${netPosition >= 0 ? "text-emerald-700" : "text-red-700"}`}
            >
              {formatCurrency(netPosition)}
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
