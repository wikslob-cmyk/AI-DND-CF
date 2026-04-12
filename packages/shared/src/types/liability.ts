import type { EntityCode, LiabilityType, LiabilityStatus } from "../index.js";

export interface LiabilityRow {
  id: number;
  entityCode: EntityCode;
  name: string;
  type: LiabilityType;
  status: LiabilityStatus;
  originalAmount: number;
  currentBalance: number;
  sourceFile: string | null;
  config: Record<string, unknown>;
}

export interface ScheduleEntry {
  id: number;
  liabilityId: number;
  liabilityName: string;
  entityCode: EntityCode;
  paymentDate: string;
  capital: number;
  interest: number;
  total: number;
  installmentNumber: number;
}

export interface MonthlySchedule {
  month: string;
  entries: ScheduleEntry[];
  totalCapital: number;
  totalInterest: number;
  totalAmount: number;
}
