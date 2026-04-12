import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { EntityTabs } from "@/features/dashboard/entity-tabs";
import { InvoiceTable } from "./invoice-table";

interface InvoiceRow {
  id: number;
  entityCode: string;
  documentNumber: string;
  contractorName: string;
  paymentDue: string;
  currency: string;
  remainingAmount: number;
  remainingAmountPln: number;
}

interface InvoiceGroup {
  contractorNip: string;
  contractorName: string;
  totalRemainingPln: number;
  invoices: InvoiceRow[];
}

interface PeriodData {
  groups: InvoiceGroup[];
  totalPln: number;
}

function ReceivablesContent({
  entity,
}: {
  entity: string;
}): ReactNode {
  const periods = ["7d", "30d", "overdue"] as const;
  const titles: Record<string, string> = {
    "7d": "Najblizsze 7 dni",
    "30d": "Najblizsze 30 dni",
    overdue: "Przeterminowane",
  };

  const queries = periods.map((period) =>
    useQuery({
      queryKey: ["receivables", entity, period],
      queryFn: () =>
        api.get<PeriodData>(
          `/api/receivables?entity=${entity}&period=${period}`,
        ),
    }),
  );

  const isLoading = queries.some((q) => q.isLoading);

  if (isLoading) {
    return <p className="py-8 text-center text-gray-500">Ladowanie...</p>;
  }

  return (
    <div className="space-y-4">
      {periods.map((period, idx) => {
        const data = queries[idx]?.data;
        return (
          <InvoiceTable
            key={period}
            title={titles[period] ?? period}
            groups={data?.groups ?? []}
            totalPln={data?.totalPln ?? 0}
          />
        );
      })}
    </div>
  );
}

export function ReceivablesPage(): ReactNode {
  const [entity, setEntity] = useState("all");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Naleznosci</h2>
        <p className="text-sm text-gray-500">
          Faktury sprzedazy (FS) pogrupowane per kontrahent
        </p>
      </div>
      <EntityTabs activeEntity={entity} onEntityChange={setEntity}>
        {(ent) => <ReceivablesContent entity={ent} />}
      </EntityTabs>
    </div>
  );
}
