import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { EntityTabs } from "@/features/dashboard/entity-tabs";
import { LiabilityList } from "./liability-list";
import { LiabilityTimeline } from "./liability-timeline";

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

interface LiabilitiesData {
  liabilities: LiabilityRow[];
}

interface MonthlySchedule {
  month: string;
  entries: Array<{
    liabilityName: string;
    entityCode: string;
    total: number;
    capital: number;
    interest: number;
    isRolling?: boolean;
  }>;
  totalCapital: number;
  totalInterest: number;
  totalAmount: number;
}

interface ScheduleData {
  schedule: MonthlySchedule[];
}

function LiabilitiesContent({
  entity,
}: {
  entity: string;
}): ReactNode {
  const { data: liabilitiesData, isLoading: isLoadingList } = useQuery({
    queryKey: ["liabilities", entity],
    queryFn: () =>
      api.get<LiabilitiesData>(`/api/liabilities?entity=${entity}`),
  });

  const { data: infoData, isLoading: isLoadingInfo } = useQuery({
    queryKey: ["liabilities-info", entity],
    queryFn: () =>
      api.get<LiabilitiesData>(
        `/api/liabilities?entity=${entity}&type=info`,
      ),
  });

  const { data: scheduleData, isLoading: isLoadingSchedule } = useQuery({
    queryKey: ["liabilities-schedule", entity],
    queryFn: () =>
      api.get<ScheduleData>(
        `/api/liabilities/schedule?entity=${entity}&months=12`,
      ),
  });

  if (isLoadingList || isLoadingSchedule || isLoadingInfo) {
    return <p className="py-8 text-center text-gray-500">Ladowanie...</p>;
  }

  const activeLiabilities = (liabilitiesData?.liabilities ?? []).filter(
    (l) => l.status !== "informational",
  );
  const infoLiabilities = infoData?.liabilities ?? [];

  return (
    <div className="space-y-4">
      <LiabilityList title="Aktywne zobowiazania" liabilities={activeLiabilities} />
      <LiabilityTimeline schedule={scheduleData?.schedule ?? []} />
      <LiabilityList
        title="Zobowiazania informacyjne"
        liabilities={infoLiabilities}
      />
    </div>
  );
}

export function LiabilitiesPage(): ReactNode {
  const [entity, setEntity] = useState("all");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Zobowiazania finansowe
        </h2>
        <p className="text-sm text-gray-500">
          Kredyty, leasingi, limity i pozycje informacyjne
        </p>
      </div>
      <EntityTabs activeEntity={entity} onEntityChange={setEntity}>
        {(ent) => <LiabilitiesContent entity={ent} />}
      </EntityTabs>
    </div>
  );
}
