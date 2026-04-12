import { type ReactNode } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ScheduleEntry {
  liabilityName: string;
  entityCode: string;
  total: number;
  isRolling?: boolean;
}

interface MonthlySchedule {
  month: string;
  entries: ScheduleEntry[];
  totalAmount: number;
}

interface LiabilityTimelineProps {
  schedule: MonthlySchedule[];
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const months = [
    "Sty",
    "Lut",
    "Mar",
    "Kwi",
    "Maj",
    "Cze",
    "Lip",
    "Sie",
    "Wrz",
    "Paz",
    "Lis",
    "Gru",
  ];
  const monthIdx = Number(month) - 1;
  return `${months[monthIdx] ?? month} ${year}`;
}

export function LiabilityTimeline({
  schedule,
}: LiabilityTimelineProps): ReactNode {
  if (schedule.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Harmonogram platnosci
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Brak harmonogramu</p>
        </CardContent>
      </Card>
    );
  }

  // Collect unique liability names
  const liabilityNames = new Set<string>();
  for (const month of schedule) {
    for (const entry of month.entries) {
      liabilityNames.add(entry.liabilityName);
    }
  }
  const names = Array.from(liabilityNames).sort();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Harmonogram platnosci (12 miesiecy)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4 font-medium">Pozycja</th>
                {schedule.map((m) => (
                  <th
                    key={m.month}
                    className="pb-2 text-right font-medium"
                  >
                    {formatMonth(m.month)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {names.map((name) => (
                <tr key={name} className="border-b last:border-0">
                  <td className="py-1 pr-4 font-medium">{name}</td>
                  {schedule.map((m) => {
                    const entry = m.entries.find(
                      (e) => e.liabilityName === name,
                    );
                    return (
                      <td
                        key={m.month}
                        className="py-1 text-right"
                      >
                        {entry ? formatCurrency(entry.total) : "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold">
                <td className="py-1 pr-4">Suma</td>
                {schedule.map((m) => (
                  <td key={m.month} className="py-1 text-right">
                    {formatCurrency(m.totalAmount)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
