/**
 * NIPs of group entities (podmioty powiązane).
 * Invoices between these entities are excluded from payables/receivables views.
 */
export const RELATED_NIPS = [
  "8733301724", // DND Group
  "8733263030", // DND Sp. z o.o.
  "8722426132", // CGE
  "8733273146", // TDM
  "8733266057", // TDP
] as const;
