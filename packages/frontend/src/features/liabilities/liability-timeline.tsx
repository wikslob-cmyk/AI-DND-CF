import { type ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ENTITY_NAMES } from "@dnd/shared";
import type { EntityCode } from "@dnd/shared";

interface ScheduleEntry {
  liabilityName: string;
  entityCode: string;
  total: number;
  capital: number;
  interest: number;
  isRolling?: boolean;
}

interface MonthlySchedule {
  month: string;
  entries: ScheduleEntry[];
  totalCapital: number;
  totalInterest: number;
  totalAmount: number;
}

interface LiabilityTimelineProps {
  schedule: MonthlySchedule[];
}

const MONTH_SHORT = [
  "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze",
  "Lip", "Sie", "Wrz", "Paz", "Lis", "Gru",
];

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const idx = Number(month) - 1;
  return `${MONTH_SHORT[idx]} ${year}`;
}

function fmtNum(n: number): string {
  const int = Math.floor(Math.abs(n));
  const dec = Math.round((Math.abs(n) - int) * 100).toString().padStart(2, "0");
  const str = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "-" : ""}${str},${dec}`;
}

export function LiabilityTimeline({
  schedule,
}: LiabilityTimelineProps): ReactNode {
  if (schedule.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Harmonogram platnosci</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Brak harmonogramu</p>
        </CardContent>
      </Card>
    );
  }

  const liabilityNames = new Set<string>();
  const entityMap = new Map<string, string>();
  for (const month of schedule) {
    for (const entry of month.entries) {
      liabilityNames.add(entry.liabilityName);
      entityMap.set(
        entry.liabilityName,
        ENTITY_NAMES[entry.entityCode as EntityCode] ?? entry.entityCode,
      );
    }
  }
  const names = Array.from(liabilityNames).sort();

  const grandTotal = schedule.reduce((s, m) => s + m.totalAmount, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Harmonogram platnosci</CardTitle>
        <span className="text-sm text-gray-500">
          Razem 12 mies.:{" "}
          <span className="font-semibold text-gray-900">
            {fmtNum(grandTotal)} zl
          </span>
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-max min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="sticky left-0 z-10 bg-gray-50 text-left py-2 px-3 font-medium text-gray-500 min-w-[180px] border-r border-gray-200">
                  Zobowiazanie
                </th>
                {schedule.map((m) => (
                  <th
                    key={m.month}
                    className="py-2 px-1 text-center font-medium text-gray-500 min-w-[85px]"
                  >
                    {formatMonth(m.month)}
                  </th>
                ))}
                <th className="py-2 px-2 text-center font-medium text-gray-500 min-w-[95px] border-l border-gray-200">
                  Razem
                </th>
              </tr>
            </thead>
            <tbody>
              {names.map((name, idx) => {
                const rowTotal = schedule.reduce((s, m) => {
                  const e = m.entries.find((e) => e.liabilityName === name);
                  return s + (e?.total ?? 0);
                }, 0);

                return (
                  <tr
                    key={name}
                    className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                  >
                    <td className={`sticky left-0 z-10 py-1.5 px-3 border-r border-gray-200 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                      <div className="font-medium text-gray-800 truncate">{name}</div>
                      <div className="text-[10px] text-gray-400">{entityMap.get(name)}</div>
                    </td>
                    {schedule.map((m) => {
                      const entry = m.entries.find(
                        (e) => e.liabilityName === name,
                      );
                      return (
                        <td
                          key={m.month}
                          className="py-1.5 px-1 text-right tabular-nums text-gray-700 whitespace-nowrap"
                        >
                          {entry ? fmtNum(entry.total) : (
                            <span className="text-gray-200">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-gray-800 whitespace-nowrap border-l border-gray-200">
                      {fmtNum(rowTotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
                <td className="sticky left-0 z-10 bg-gray-100 py-2 px-3 border-r border-gray-200">
                  Suma
                </td>
                {schedule.map((m) => (
                  <td
                    key={m.month}
                    className="py-2 px-1 text-right tabular-nums whitespace-nowrap"
                  >
                    {fmtNum(m.totalAmount)}
                  </td>
                ))}
                <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap border-l border-gray-200">
                  {fmtNum(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
