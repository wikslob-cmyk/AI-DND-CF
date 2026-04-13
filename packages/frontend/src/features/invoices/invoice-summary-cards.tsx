import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface SummaryItem {
  totalPln: number;
  invoiceCount: number;
  contractorCount: number;
}

interface InvoiceSummaryCardsProps {
  all: SummaryItem;
  overdue: SummaryItem;
  inTerm: SummaryItem;
}

function SummaryCard({
  title,
  item,
  accent,
}: {
  title: string;
  item: SummaryItem;
  accent: "neutral" | "red" | "green";
}): ReactNode {
  const accentClasses = {
    neutral: "border-l-blue-500",
    red: "border-l-red-500",
    green: "border-l-emerald-500",
  };

  const amountClasses = {
    neutral: "text-gray-900",
    red: "text-red-700",
    green: "text-emerald-700",
  };

  return (
    <Card className={`border-l-4 ${accentClasses[accent]} p-4`}>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className={`mt-1 text-xl font-bold ${amountClasses[accent]}`}>
        {formatCurrency(item.totalPln)}
      </p>
      <div className="mt-2 flex gap-4 text-xs text-gray-500">
        <span>{item.invoiceCount} faktur</span>
        <span>{item.contractorCount} kontrahentow</span>
      </div>
    </Card>
  );
}

export function InvoiceSummaryCards({
  all,
  overdue,
  inTerm,
}: InvoiceSummaryCardsProps): ReactNode {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SummaryCard title="Lacznie" item={all} accent="neutral" />
      <SummaryCard title="Przeterminowane" item={overdue} accent="red" />
      <SummaryCard title="W terminie" item={inTerm} accent="green" />
    </div>
  );
}
