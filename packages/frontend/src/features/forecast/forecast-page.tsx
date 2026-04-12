import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ForecastInvoice {
  id: number;
  entityCode: string;
  documentNumber: string;
  contractorName: string;
  paymentDue: string;
  currency: string;
  remainingAmount: number;
  remainingAmountPln: number;
}

interface WeekBucket {
  weekLabel: string;
  startDate: string;
  endDate: string;
  totalPln: number;
  invoices: ForecastInvoice[];
}

interface ForecastData {
  days: number;
  forecast: {
    totalPln: number;
    weeks: WeekBucket[];
  };
  overdue: {
    totalPln: number;
    invoices: ForecastInvoice[];
  };
}

export function ForecastPage(): ReactNode {
  const { data, isLoading, error } = useQuery({
    queryKey: ["forecast"],
    queryFn: () => api.get<ForecastData>("/api/forecast?days=30"),
  });

  if (isLoading) {
    return <p className="py-8 text-center text-gray-500">Ladowanie...</p>;
  }

  if (error) {
    return (
      <p className="py-8 text-center text-red-600">
        Blad: {error instanceof Error ? error.message : "Nieznany"}
      </p>
    );
  }

  if (!data) {
    return <p className="py-8 text-center text-gray-500">Brak danych</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Prognoza wplywow
        </h2>
        <p className="text-sm text-gray-500">
          Oczekiwane naleznosci pogrupowane per tydzien (naiwna prognoza)
        </p>
      </div>

      {/* Expected inflows */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Oczekiwane wplywy ({data.days} dni) -{" "}
            {formatCurrency(data.forecast.totalPln)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.forecast.weeks.map((week) => (
              <div key={week.weekLabel}>
                <div className="flex items-center justify-between border-b pb-1">
                  <span className="text-sm font-medium">
                    {week.weekLabel} ({formatDate(week.startDate)} -{" "}
                    {formatDate(week.endDate)})
                  </span>
                  <span className="text-sm font-bold">
                    {formatCurrency(week.totalPln)}
                  </span>
                </div>
                {week.invoices.length > 0 && (
                  <table className="mt-1 w-full text-xs">
                    <tbody>
                      {week.invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="py-0.5">
                            {inv.contractorName}
                          </td>
                          <td className="py-0.5 uppercase">
                            {inv.entityCode}
                          </td>
                          <td className="py-0.5">
                            {formatDate(inv.paymentDue)}
                          </td>
                          <td className="py-0.5 text-right">
                            {formatCurrency(inv.remainingAmountPln)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {week.invoices.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    Brak oczekiwanych wplywow
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Overdue (uncertain) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Przeterminowane (niepewne) -{" "}
            {formatCurrency(data.overdue.totalPln)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.overdue.invoices.length === 0 ? (
            <p className="text-sm text-gray-500">
              Brak przeterminowanych naleznosci
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-1 font-medium">Kontrahent</th>
                  <th className="pb-1 font-medium">Podmiot</th>
                  <th className="pb-1 font-medium">Termin</th>
                  <th className="pb-1 text-right font-medium">
                    Kwota PLN
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.overdue.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-1">{inv.contractorName}</td>
                    <td className="py-1 uppercase">{inv.entityCode}</td>
                    <td className="py-1">{formatDate(inv.paymentDue)}</td>
                    <td className="py-1 text-right">
                      {formatCurrency(inv.remainingAmountPln)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
