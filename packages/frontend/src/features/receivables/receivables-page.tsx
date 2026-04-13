import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { EntityTabs } from "@/features/dashboard/entity-tabs";
import { InvoiceSummaryCards } from "@/features/invoices/invoice-summary-cards";
import { InvoiceGroupedTable } from "@/features/invoices/invoice-grouped-table";

interface InvoiceRow {
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

interface SummaryItem {
  totalPln: number;
  invoiceCount: number;
  contractorCount: number;
}

interface AllInvoicesResponse {
  summary: {
    all: SummaryItem;
    overdue: SummaryItem;
    inTerm: SummaryItem;
  };
  invoices: InvoiceRow[];
}

function ReceivablesContent({ entity }: { entity: string }): ReactNode {
  const { data, isLoading } = useQuery({
    queryKey: ["receivables", "all", entity],
    queryFn: () =>
      api.get<AllInvoicesResponse>(
        `/api/receivables/all?entity=${entity}`,
      ),
  });

  if (isLoading) {
    return <p className="py-8 text-center text-gray-500">Ladowanie...</p>;
  }

  if (!data) {
    return <p className="py-8 text-center text-gray-500">Brak danych</p>;
  }

  return (
    <div className="space-y-6">
      <InvoiceSummaryCards
        all={data.summary.all}
        overdue={data.summary.overdue}
        inTerm={data.summary.inTerm}
      />
      <InvoiceGroupedTable invoices={data.invoices} />
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
          Faktury sprzedazy pogrupowane wg tygodni lub kontrahenta
        </p>
      </div>
      <EntityTabs activeEntity={entity} onEntityChange={setEntity}>
        {(ent) => <ReceivablesContent entity={ent} />}
      </EntityTabs>
    </div>
  );
}
