import { type ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

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

interface InvoiceTableProps {
  title: string;
  groups: InvoiceGroup[];
  totalPln: number;
}

export function InvoiceTable({
  title,
  groups,
  totalPln,
}: InvoiceTableProps): ReactNode {
  if (groups.length === 0) {
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
                <th className="pb-2 font-medium">Kontrahent</th>
                <th className="pb-2 font-medium">Nr dokumentu</th>
                <th className="pb-2 font-medium">Podmiot</th>
                <th className="pb-2 font-medium">Termin</th>
                <th className="pb-2 text-right font-medium">
                  Kwota
                </th>
                <th className="pb-2 text-right font-medium">
                  Kwota PLN
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <GroupRows key={group.contractorNip} group={group} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold">
                <td colSpan={5} className="pt-2">
                  Suma
                </td>
                <td className="pt-2 text-right">
                  {formatCurrency(totalPln)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function GroupRows({ group }: { group: InvoiceGroup }): ReactNode {
  return (
    <>
      {group.invoices.map((inv, idx) => (
        <tr
          key={inv.id}
          className={idx === 0 ? "border-t" : ""}
        >
          <td className="py-1">
            {idx === 0 ? group.contractorName : ""}
          </td>
          <td className="py-1">{inv.documentNumber}</td>
          <td className="py-1 uppercase">{inv.entityCode}</td>
          <td className="py-1">{formatDate(inv.paymentDue)}</td>
          <td className="py-1 text-right">
            {inv.currency !== "PLN"
              ? `${formatCurrency(inv.remainingAmount, inv.currency)}`
              : ""}
          </td>
          <td className="py-1 text-right">
            {formatCurrency(inv.remainingAmountPln)}
          </td>
        </tr>
      ))}
      {group.invoices.length > 1 && (
        <tr className="bg-gray-50 text-xs font-medium text-gray-600">
          <td colSpan={5} className="py-1">
            Suma kontrahenta
          </td>
          <td className="py-1 text-right">
            {formatCurrency(group.totalRemainingPln)}
          </td>
        </tr>
      )}
    </>
  );
}
