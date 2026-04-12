export const ENTITY_CODES = ["cgesp", "dngro", "dndsp", "tdmsp", "tdpsp"] as const;

export type EntityCode = (typeof ENTITY_CODES)[number];

export const ENTITY_NAMES: Record<EntityCode, string> = {
  cgesp: "CGE Sp. z o.o.",
  dngro: "DND Group Sp. z o.o.",
  dndsp: "DND Sp. z o.o.",
  tdmsp: "TDM Sp. z o.o.",
  tdpsp: "TDP Sp. z o.o.",
};

export const INVOICE_TYPES = ["FS", "FZ"] as const;

export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const PERIOD_TYPES = ["7d", "30d", "overdue"] as const;

export type PeriodType = (typeof PERIOD_TYPES)[number];

export const LIABILITY_TYPES = [
  "leasing",
  "credit",
  "limit",
  "factoring",
  "info",
] as const;

export type LiabilityType = (typeof LIABILITY_TYPES)[number];

export const LIABILITY_STATUSES = [
  "active",
  "pending_write_off",
  "informational",
] as const;

export type LiabilityStatus = (typeof LIABILITY_STATUSES)[number];

export function isEntityCode(value: string): value is EntityCode {
  return (ENTITY_CODES as readonly string[]).includes(value);
}
