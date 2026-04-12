export class ScheduleParseError extends Error {
  constructor(
    message: string,
    public readonly filename: string,
  ) {
    super(message);
    this.name = "ScheduleParseError";
  }
}

export interface ParsedScheduleEntry {
  installmentNumber: number;
  paymentDate: Date;
  capital: number;
  interest: number;
  total: number;
}

export interface ParsedSchedule {
  sourceFile: string;
  entries: ParsedScheduleEntry[];
}

/**
 * Maps source file names to liability identifiers used in seed data.
 * This allows the orchestrator to match parsed schedules to existing liability rows.
 */
export const SCHEDULE_FILE_MAP: Record<
  string,
  { entityCode: string; liabilityName: string }
> = {
  "tabela_rat_wynagrodzenia.xlsx": {
    entityCode: "cgesp",
    liabilityName: "Millennium Leasing - piec",
  },
  "tabela_rat_364944.xlsx": {
    entityCode: "cgesp",
    liabilityName: "Millennium Leasing - młyn + prasa",
  },
  "Harmonogram.pdf": {
    entityCode: "cgesp",
    liabilityName: "Alior Bank",
  },
  "harmonogram_splat_EFL_6F01694.xlsx": {
    entityCode: "cgesp",
    liabilityName: "EFL - linia produkcyjna",
  },
  "harmonogram_splat_EFL6F01696.xlsx": {
    entityCode: "cgesp",
    liabilityName: "EFL - piec 1",
  },
  "harmonogram_splat_EFL6F01695.xlsx": {
    entityCode: "cgesp",
    liabilityName: "EFL - piec 2",
  },
  "harmonogram_santander_NP6_00258_2023.xlsx": {
    entityCode: "dngro",
    liabilityName: "Santander Leasing - Volvo",
  },
  "Harmonogram_platnosci-dndgr-mercedes.xlsx": {
    entityCode: "dngro",
    liabilityName: "Mercedes S-klasa",
  },
  "Harmonogram spłat_nr umowy 01450_PI_24.pdf": {
    entityCode: "dngro",
    liabilityName: "PKO Leasing",
  },
  "DNDspzoo-leasing.pdf": {
    entityCode: "dndsp",
    liabilityName: "Mercedes Leasing",
  },
  "TDM-leas.xlsx": {
    entityCode: "tdmsp",
    liabilityName: "Millennium Leasing - zgrzewarka",
  },
};

/** Files that are scans and cannot be parsed */
export const SCAN_PDF_FILES = [
  "LFR.pdf",
  "Harmonogram płatności nowy 22_07_2025.pdf",
];
