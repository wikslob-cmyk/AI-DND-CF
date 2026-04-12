import { type ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface LiabilityRow {
  id: number;
  entityCode: string;
  name: string;
  type: string;
  status: string;
  originalAmount: number;
  currentBalance: number;
  sourceFile: string | null;
}

interface LiabilityListProps {
  title: string;
  liabilities: LiabilityRow[];
}

export function LiabilityList({
  title,
  liabilities,
}: LiabilityListProps): ReactNode {
  if (liabilities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Brak pozycji</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Podmiot</th>
                <th className="pb-2 font-medium">Nazwa</th>
                <th className="pb-2 font-medium">Typ</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">
                  Kwota pierwotna
                </th>
                <th className="pb-2 text-right font-medium">
                  Saldo biezace
                </th>
              </tr>
            </thead>
            <tbody>
              {liabilities.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2 uppercase">{l.entityCode}</td>
                  <td className="py-2">{l.name}</td>
                  <td className="py-2">{l.type}</td>
                  <td className="py-2">
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="py-2 text-right">
                    {formatCurrency(l.originalAmount)}
                  </td>
                  <td className="py-2 text-right">
                    {formatCurrency(l.currentBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }): ReactNode {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    pending_write_off: "bg-yellow-100 text-yellow-800",
    informational: "bg-blue-100 text-blue-800",
  };
  const labels: Record<string, string> = {
    active: "Aktywne",
    pending_write_off: "Oczekuje odpisu",
    informational: "Informacyjne",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
