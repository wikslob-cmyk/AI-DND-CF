import { type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface SummaryCardProps {
  title: string;
  amount: number;
  subtitle?: string;
  subtitleAmount?: number;
  accent: string;
  navigateTo?: string;
}

function SummaryCard({
  title,
  amount,
  subtitle,
  subtitleAmount,
  accent,
  navigateTo,
}: SummaryCardProps): ReactNode {
  const navigate = useNavigate();

  return (
    <Card
      className={`cursor-pointer transition-shadow hover:shadow-md ${accent}`}
      onClick={() => navigateTo && navigate(navigateTo)}
    >
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-gray-500">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{formatCurrency(amount)}</p>
        {subtitle && subtitleAmount !== undefined && subtitleAmount > 0 && (
          <p className="text-xs text-red-500 mt-1">
            w tym przeterminowane: {formatCurrency(subtitleAmount)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface SummaryData {
  receivablesTotal: number;
  overdueReceivables: number;
  payablesTotal: number;
  overduePayables: number;
  liabilities30d: number;
  bankBalance: number;
  warehouseValue: number;
  lastImport: { importedAt: string; status: string } | null;
}

interface SummaryCardsProps {
  data: SummaryData;
}

export function SummaryCards({ data }: SummaryCardsProps): ReactNode {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          title="Naleznosci"
          amount={data.receivablesTotal}
          subtitle="w tym przeterminowane"
          subtitleAmount={data.overdueReceivables}
          accent="border-l-4 border-l-green-500"
          navigateTo="/dashboard/receivables"
        />
        <SummaryCard
          title="Zobowiazania handlowe"
          amount={data.payablesTotal}
          subtitle="w tym przeterminowane"
          subtitleAmount={data.overduePayables}
          accent="border-l-4 border-l-orange-500"
          navigateTo="/dashboard/payables"
        />
        <SummaryCard
          title="Zobowiazania finansowe (30 dni)"
          amount={data.liabilities30d}
          accent="border-l-4 border-l-red-500"
          navigateTo="/dashboard/liabilities"
        />
        <SummaryCard
          title="Saldo bankowe"
          amount={data.bankBalance}
          accent="border-l-4 border-l-blue-500"
          navigateTo="/dashboard/monthly-input"
        />
        {data.warehouseValue > 0 && (
          <SummaryCard
            title="Wartosc magazynu"
            amount={data.warehouseValue}
            accent="border-l-4 border-l-purple-500"
            navigateTo="/dashboard/warehouse"
          />
        )}
      </div>

      {data.lastImport && (
        <p className="text-sm text-gray-500">
          Ostatni import:{" "}
          {new Date(data.lastImport.importedAt).toLocaleString("pl-PL")} (
          {data.lastImport.status})
        </p>
      )}
    </div>
  );
}
