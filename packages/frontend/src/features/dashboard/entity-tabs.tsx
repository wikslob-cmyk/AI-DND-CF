import { type ReactNode } from "react";
import { ENTITY_CODES, ENTITY_NAMES, type EntityCode } from "@dnd/shared";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const TAB_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Grupa" },
  ...ENTITY_CODES.map((code) => ({
    value: code,
    label: ENTITY_NAMES[code].replace(" Sp. z o.o.", ""),
  })),
];

interface EntityTabsProps {
  activeEntity: string;
  onEntityChange: (entity: string) => void;
  children: (entity: string) => ReactNode;
}

export function EntityTabs({
  activeEntity,
  onEntityChange,
  children,
}: EntityTabsProps): ReactNode {
  return (
    <Tabs
      defaultValue="all"
      value={activeEntity}
      onValueChange={onEntityChange}
    >
      <TabsList className="flex-wrap">
        {TAB_OPTIONS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {TAB_OPTIONS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {children(tab.value)}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function isEntityCode(value: string): value is EntityCode {
  return (ENTITY_CODES as readonly string[]).includes(value);
}
