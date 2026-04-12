import { type ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ENTITY_NAMES, LIABILITY_TYPE_LABELS } from "@dnd/shared";
import type { EntityCode, LiabilityType } from "@dnd/shared";
import { formatCurrency } from "@/lib/utils";

interface LiabilityRow {
  id: number;
  entityCode: string;
  name: string;
  type: string;
  status: string;
  currentBalance: number;
  sourceFile: string | null;
}

interface LiabilityListProps {
  title: string;
  liabilities: LiabilityRow[];
}

const TYPE_ORDER: string[] = [
  "credit",
  "loan",
  "leasing_financial",
  "leasing_operational",
  "limit",
  "factoring",
];

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

  // Group by type
  const groups = new Map<string, LiabilityRow[]>();
  for (const l of liabilities) {
    const list = groups.get(l.type) ?? [];
    list.push(l);
    groups.set(l.type, list);
  }

  // Sort groups by TYPE_ORDER
  const sortedTypes = Array.from(groups.keys()).sort(
    (a, b) => (TYPE_ORDER.indexOf(a) === -1 ? 99 : TYPE_ORDER.indexOf(a)) -
              (TYPE_ORDER.indexOf(b) === -1 ? 99 : TYPE_ORDER.indexOf(b)),
  );

  const totalBalance = liabilities.reduce(
    (sum, l) => sum + l.currentBalance,
    0,
  );

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
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">
                  Saldo biezace
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTypes.map((type) => {
                const items = groups.get(type) ?? [];
                const groupTotal = items.reduce(
                  (s, l) => s + l.currentBalance,
                  0,
                );

                return (
                  <GroupSection
                    key={type}
                    type={type}
                    items={items}
                    groupTotal={groupTotal}
                  />
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-800 bg-gray-100">
                <td
                  colSpan={3}
                  className="py-2.5 px-1 font-bold"
                >
                  Razem zobowiazania
                </td>
                <td className="py-2.5 text-right font-bold">
                  {formatCurrency(totalBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function GroupSection({
  type,
  items,
  groupTotal,
}: {
  type: string;
  items: LiabilityRow[];
  groupTotal: number;
}): ReactNode {
  const label =
    LIABILITY_TYPE_LABELS[type as LiabilityType] ?? type;

  return (
    <>
      {/* Group header */}
      <tr className="bg-gray-50 border-t border-gray-200">
        <td
          colSpan={4}
          className="py-2 px-1 text-xs font-semibold text-gray-500 uppercase tracking-wide"
        >
          {label}
        </td>
      </tr>
      {/* Items */}
      {items.map((l) => (
        <tr key={l.id} className="border-b border-gray-100">
          <td className="py-1.5 px-1 text-gray-600">
            {ENTITY_NAMES[l.entityCode as EntityCode] ?? l.entityCode}
          </td>
          <td className="py-1.5 font-medium text-gray-800">{l.name}</td>
          <td className="py-1.5">
            <StatusBadge status={l.status} />
          </td>
          <td className="py-1.5 text-right tabular-nums font-medium">
            {formatCurrency(l.currentBalance)}
          </td>
        </tr>
      ))}
      {/* Group subtotal */}
      <tr className="border-b border-gray-300 bg-gray-50">
        <td
          colSpan={3}
          className="py-1.5 px-1 text-right text-xs font-semibold text-gray-500"
        >
          Razem {label.toLowerCase()}
        </td>
        <td className="py-1.5 text-right tabular-nums font-semibold text-gray-700">
          {formatCurrency(groupTotal)}
        </td>
      </tr>
    </>
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
