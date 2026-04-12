import { useState, type ReactNode } from "react";
import { Outlet } from "react-router";
import { EntityTabs } from "./entity-tabs";

export function DashboardPage(): ReactNode {
  const [activeEntity, setActiveEntity] = useState("all");

  return (
    <div className="space-y-6">
      <EntityTabs
        activeEntity={activeEntity}
        onEntityChange={setActiveEntity}
      >
        {() => <Outlet context={{ entity: activeEntity }} />}
      </EntityTabs>
    </div>
  );
}
