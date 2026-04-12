import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { EntityTabs } from "./entity-tabs";
import { SummaryCards } from "./summary-cards";

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

export function SummaryPage(): ReactNode {
  const [entity, setEntity] = useState("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-summary", entity],
    queryFn: () =>
      api.get<SummaryData>(`/api/dashboard/summary?entity=${entity}`),
  });

  return (
    <div className="space-y-6">
      <EntityTabs activeEntity={entity} onEntityChange={setEntity}>
        {() => {
          if (isLoading) {
            return (
              <p className="py-8 text-center text-gray-500">
                Ladowanie...
              </p>
            );
          }

          if (error) {
            return (
              <p className="py-8 text-center text-red-600">
                Blad ladowania danych:{" "}
                {error instanceof Error ? error.message : "Nieznany blad"}
              </p>
            );
          }

          if (!data) {
            return (
              <p className="py-8 text-center text-gray-500">
                Brak danych. Zaimportuj pliki aby zobaczyc podsumowanie.
              </p>
            );
          }

          return <SummaryCards data={data} />;
        }}
      </EntityTabs>
    </div>
  );
}
