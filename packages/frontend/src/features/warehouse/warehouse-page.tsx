import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface WarehouseItem {
  id: number;
  articleName: string;
  quantityComponent: number;
  quantityFinished: number;
  quantityTotal: number;
  unitPrice: number;
  valueTotal: number;
}

interface WarehouseData {
  entityCode: string;
  items: WarehouseItem[];
  totalValue: number;
}

export function WarehousePage(): ReactNode {
  const { data, isLoading, error } = useQuery({
    queryKey: ["warehouse"],
    queryFn: () => api.get<WarehouseData>("/api/warehouse"),
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

  if (!data || data.items.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500">
        Brak danych magazynowych. Zaimportuj zestawienie magazynowe.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Stany magazynowe
        </h2>
        <p className="text-sm text-gray-500">
          DND Group Sp. z o.o. — laczna wartosc:{" "}
          {formatCurrency(data.totalValue)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Artykuly</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">Artykul</th>
                  <th className="pb-2 text-right font-medium">
                    Komponenty
                  </th>
                  <th className="pb-2 text-right font-medium">
                    Gotowe
                  </th>
                  <th className="pb-2 text-right font-medium">
                    Razem
                  </th>
                  <th className="pb-2 text-right font-medium">
                    Cena jedn.
                  </th>
                  <th className="pb-2 text-right font-medium">
                    Wartosc
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-0"
                  >
                    <td className="py-2">{item.articleName}</td>
                    <td className="py-2 text-right">
                      {item.quantityComponent}
                    </td>
                    <td className="py-2 text-right">
                      {item.quantityFinished}
                    </td>
                    <td className="py-2 text-right">
                      {item.quantityTotal}
                    </td>
                    <td className="py-2 text-right">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="py-2 text-right">
                      {formatCurrency(item.valueTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td colSpan={5} className="pt-2">
                    Suma
                  </td>
                  <td className="pt-2 text-right">
                    {formatCurrency(data.totalValue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
