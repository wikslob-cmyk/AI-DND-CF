import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

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

type ViewMode = "weeks" | "contractor";
type StatusFilter = "all" | "overdue" | "inTerm";

interface InvoiceGroupedTableProps {
  invoices: InvoiceRow[];
}

interface WeekGroup {
  key: string;
  label: string;
  isOverdue: boolean;
  totalPln: number;
  invoices: InvoiceRow[];
}

interface ContractorGroup {
  key: string;
  name: string;
  nip: string;
  totalPln: number;
  invoices: InvoiceRow[];
}

function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  return monday.toISOString().split("T")[0] as string;
}

function getWeekLabel(mondayStr: string): string {
  const monday = new Date(mondayStr);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date): string =>
    d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });

  const year = monday.getFullYear();
  return `${fmt(monday)} - ${fmt(sunday)} ${year}`;
}

function groupByWeek(invoices: InvoiceRow[]): WeekGroup[] {
  const map = new Map<string, WeekGroup>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentWeekKey = getWeekKey(today.toISOString().split("T")[0] as string);

  for (const inv of invoices) {
    const key = getWeekKey(inv.paymentDue);

    if (!map.has(key)) {
      map.set(key, {
        key,
        label: getWeekLabel(key),
        isOverdue: key < currentWeekKey,
        totalPln: 0,
        invoices: [],
      });
    }

    const group = map.get(key)!;
    group.totalPln += inv.remainingAmountPln;
    group.invoices.push(inv);
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
}

/** Known contractor name aliases — maps keyword to canonical group name */
const CONTRACTOR_ALIASES: Array<[RegExp, string]> = [
  [/ikea/i, "IKEA Supply AG"],
];

function normalizeContractorKey(name: string, nip: string): { key: string; displayName: string } {
  const trimmedName = name.trim();

  for (const [pattern, canonical] of CONTRACTOR_ALIASES) {
    if (trimmedName && pattern.test(trimmedName)) {
      return { key: `alias:${canonical}`, displayName: canonical };
    }
  }

  const hasNip = nip && nip !== "BRAK-NIP";
  const displayName = trimmedName || "(brak kontrahenta)";
  return {
    key: hasNip ? `nip:${nip}` : `name:${displayName}`,
    displayName,
  };
}

function groupByContractor(invoices: InvoiceRow[]): ContractorGroup[] {
  const map = new Map<string, ContractorGroup>();

  for (const inv of invoices) {
    const { key, displayName } = normalizeContractorKey(inv.contractorName, inv.contractorNip);

    if (!map.has(key)) {
      const hasNip = inv.contractorNip && inv.contractorNip !== "BRAK-NIP";
      map.set(key, {
        key,
        name: displayName,
        nip: hasNip ? inv.contractorNip : "",
        totalPln: 0,
        invoices: [],
      });
    }

    const group = map.get(key)!;
    group.totalPln += inv.remainingAmountPln;
    group.invoices.push(inv);
  }

  return Array.from(map.values()).sort((a, b) => b.totalPln - a.totalPln);
}

function DaysCell({ days }: { days: number }): ReactNode {
  const isOverdue = days < 0;
  const label = isOverdue ? `${Math.abs(days)} dni` : `+${days} dni`;
  const colorClass = isOverdue ? "text-red-600 font-medium" : "text-emerald-600";

  return <span className={colorClass}>{label}</span>;
}

function InvoiceRows({
  invoices,
  showContractor,
}: {
  invoices: InvoiceRow[];
  showContractor: boolean;
}): ReactNode {
  return (
    <>
      {invoices.map((inv) => (
        <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
          <td className="py-2 pr-3 uppercase text-xs font-medium text-gray-500">
            {inv.entityCode}
          </td>
          <td className="py-2 pr-3 text-sm">{inv.documentNumber}</td>
          {showContractor && (
            <td className="py-2 pr-3 text-sm">{inv.contractorName}</td>
          )}
          <td className="py-2 pr-3 text-sm">
            <span className={inv.isOverdue ? "text-red-600" : ""}>
              {formatDate(inv.paymentDue)}
            </span>
          </td>
          <td className="py-2 pr-3 text-sm">
            <DaysCell days={inv.daysUntilDue} />
          </td>
          <td className="py-2 pr-3 text-sm text-center">
            {inv.currency !== "PLN" ? inv.currency : ""}
          </td>
          <td className="py-2 pr-3 text-sm text-right">
            {inv.currency !== "PLN"
              ? formatCurrency(inv.grossValue, inv.currency)
              : formatCurrency(inv.grossValue)}
          </td>
          <td className="py-2 pr-3 text-sm text-right">
            {inv.currency !== "PLN"
              ? formatCurrency(inv.remainingAmount, inv.currency)
              : ""}
          </td>
          <td className="py-2 text-sm text-right font-medium">
            {formatCurrency(inv.remainingAmountPln)}
          </td>
        </tr>
      ))}
    </>
  );
}

function CollapsibleGroup({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}): ReactNode {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        {header}
        <span className="ml-2 text-gray-400 text-sm">
          {isOpen ? "\u25B2" : "\u25BC"}
        </span>
      </button>
      {isOpen && (
        <div className="px-4 pb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">{children}</table>
          </div>
        </div>
      )}
    </div>
  );
}

function WeekGroupHeader({ group }: { group: WeekGroup }): ReactNode {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`text-sm font-medium ${group.isOverdue ? "text-red-700" : "text-gray-900"}`}
      >
        {group.label}
      </span>
      {group.isOverdue && (
        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          przeterminowane
        </span>
      )}
      <span className="text-xs text-gray-500">
        {group.invoices.length} faktur
      </span>
      <span className={`ml-auto text-sm font-bold ${group.isOverdue ? "text-red-700" : "text-gray-900"}`}>
        {formatCurrency(group.totalPln)}
      </span>
    </div>
  );
}

function ContractorGroupHeader({
  group,
}: {
  group: ContractorGroup;
}): ReactNode {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-900">{group.name}</span>
      {group.nip && (
        <span className="text-xs text-gray-400">NIP: {group.nip}</span>
      )}
      <span className="text-xs text-gray-500">
        {group.invoices.length} faktur
      </span>
      <span className="ml-auto text-sm font-bold text-gray-900">
        {formatCurrency(group.totalPln)}
      </span>
    </div>
  );
}

function TableHeader({ showContractor }: { showContractor: boolean }): ReactNode {
  return (
    <thead>
      <tr className="border-b text-left text-xs text-gray-500">
        <th className="pb-2 pr-3 font-medium">Podmiot</th>
        <th className="pb-2 pr-3 font-medium">Nr dokumentu</th>
        {showContractor && (
          <th className="pb-2 pr-3 font-medium">Kontrahent</th>
        )}
        <th className="pb-2 pr-3 font-medium">Termin</th>
        <th className="pb-2 pr-3 font-medium">Dni</th>
        <th className="pb-2 pr-3 font-medium text-center">Waluta</th>
        <th className="pb-2 pr-3 font-medium text-right">Brutto</th>
        <th className="pb-2 pr-3 font-medium text-right">Pozostaje</th>
        <th className="pb-2 font-medium text-right">Pozostaje PLN</th>
      </tr>
    </thead>
  );
}

export function InvoiceGroupedTable({
  invoices,
}: InvoiceGroupedTableProps): ReactNode {
  const [viewMode, setViewMode] = useState<ViewMode>("weeks");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered =
    statusFilter === "all"
      ? invoices
      : statusFilter === "overdue"
        ? invoices.filter((i) => i.isOverdue)
        : invoices.filter((i) => !i.isOverdue);

  if (invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-sm text-gray-500">Brak faktur</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="flex rounded-lg border bg-gray-50 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("weeks")}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              viewMode === "weeks"
                ? "bg-white font-medium text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Wg tygodni
          </button>
          <button
            type="button"
            onClick={() => setViewMode("contractor")}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              viewMode === "contractor"
                ? "bg-white font-medium text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Wg kontrahenta
          </button>
        </div>

        <div className="flex rounded-lg border bg-gray-50 p-0.5">
          {(
            [
              ["all", "Wszystkie"],
              ["overdue", "Przeterminowane"],
              ["inTerm", "W terminie"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                statusFilter === value
                  ? "bg-white font-medium text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <CardContent className="p-0">
        {viewMode === "weeks"
          ? groupByWeek(filtered).map((group) => (
              <CollapsibleGroup
                key={group.key}
                header={<WeekGroupHeader group={group} />}
              >
                <TableHeader showContractor />
                <tbody>
                  <InvoiceRows invoices={group.invoices} showContractor />
                </tbody>
              </CollapsibleGroup>
            ))
          : groupByContractor(filtered).map((group) => (
              <CollapsibleGroup
                key={group.key}
                header={<ContractorGroupHeader group={group} />}
              >
                <TableHeader showContractor={false} />
                <tbody>
                  <InvoiceRows invoices={group.invoices} showContractor={false} />
                </tbody>
              </CollapsibleGroup>
            ))}
      </CardContent>
    </Card>
  );
}
