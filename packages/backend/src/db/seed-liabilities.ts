import type { Sql } from "postgres";

interface LiabilitySeed {
  entity_code: string;
  name: string;
  type: string;
  status: string;
  original_amount: number;
  current_balance: number;
  source_file: string | null;
  config: Record<string, unknown>;
}

const LIABILITIES: LiabilitySeed[] = [
  // cgesp - 5 positions
  {
    entity_code: "cgesp",
    name: "Millennium Leasing - piec",
    type: "leasing_financial",
    status: "active",
    original_amount: 0,
    current_balance: 0,
    source_file: "tabela_rat_wynagrodzenia.xlsx",
    config: {},
  },
  {
    entity_code: "cgesp",
    name: "Millennium - młyn + prasa",
    type: "credit",
    status: "active",
    original_amount: 0,
    current_balance: 0,
    source_file: "tabela_rat_364944.xlsx",
    config: {},
  },
  {
    entity_code: "cgesp",
    name: "EFL - linia",
    type: "leasing_financial",
    status: "active",
    original_amount: 0,
    current_balance: 0,
    source_file: "harmonogram_splat_EFL_6F01694.xlsx",
    config: {},
  },
  {
    entity_code: "cgesp",
    name: "EFL - piec 1",
    type: "leasing_financial",
    status: "active",
    original_amount: 0,
    current_balance: 0,
    source_file: "harmonogram_splat_EFL6F01696.xlsx",
    config: {},
  },
  {
    entity_code: "cgesp",
    name: "EFL - piec 2",
    type: "leasing_financial",
    status: "active",
    original_amount: 0,
    current_balance: 0,
    source_file: "harmonogram_splat_EFL6F01695.xlsx",
    config: {},
  },

  // dngro - 7 positions
  {
    entity_code: "dngro",
    name: "Santander - Volvo",
    type: "leasing_financial",
    status: "active",
    original_amount: 0,
    current_balance: 0,
    source_file: "harmonogram_santander_NP6_00258_2023.xlsx",
    config: {},
  },
  {
    entity_code: "dngro",
    name: "Mercedes S-klasa",
    type: "leasing_financial",
    status: "active",
    original_amount: 0,
    current_balance: 0,
    source_file: "Harmonogram_platnosci-dndgr-mercedes.xlsx",
    config: {},
  },
  {
    entity_code: "dngro",
    name: "LFR",
    type: "leasing_financial",
    status: "active",
    original_amount: 0,
    current_balance: 0,
    source_file: "LFR.pdf",
    config: { manual_entry: true },
  },
  {
    entity_code: "dngro",
    name: "PKO Leasing",
    type: "leasing_financial",
    status: "active",
    original_amount: 0,
    current_balance: 0,
    source_file: "Harmonogram spłat_nr umowy 01450_PI_24.pdf",
    config: {},
  },
  {
    entity_code: "dngro",
    name: "ING - limit",
    type: "limit",
    status: "active",
    original_amount: 70000,
    current_balance: 70000,
    source_file: null,
    config: { monthly_capital: 70000, monthly_interest: 18000, rolling: true },
  },
  {
    entity_code: "dngro",
    name: "ING - faktoring",
    type: "factoring",
    status: "active",
    original_amount: 0,
    current_balance: 0,
    source_file: null,
    config: { monthly_capital: 0, monthly_interest: 15000, rolling: true },
  },
  {
    entity_code: "dngro",
    name: "Pożyczka Dawid",
    type: "loan",
    status: "active",
    original_amount: 1000000,
    current_balance: 1000000,
    source_file: null,
    config: {},
  },

  // dndsp - 1 position
  {
    entity_code: "dndsp",
    name: "Mercedes Leasing",
    type: "leasing_financial",
    status: "active",
    original_amount: 0,
    current_balance: 0,
    source_file: "DNDspzoo-leasing.pdf",
    config: {},
  },

  // tdmsp - 1 position
  {
    entity_code: "tdmsp",
    name: "Millennium - zgrzewarka",
    type: "leasing_financial",
    status: "active",
    original_amount: 0,
    current_balance: 0,
    source_file: "TDM-leas.xlsx",
    config: {},
  },

  // Informational positions
  {
    entity_code: "cgesp",
    name: "NCBiR 750 000 PLN",
    type: "info",
    status: "informational",
    original_amount: 750000,
    current_balance: 750000,
    source_file: null,
    config: {},
  },
  {
    entity_code: "cgesp",
    name: "NCBiR 3 200 000 PLN",
    type: "info",
    status: "informational",
    original_amount: 3200000,
    current_balance: 3200000,
    source_file: null,
    config: {},
  },
  {
    entity_code: "cgesp",
    name: "PARP 950 000 PLN",
    type: "info",
    status: "informational",
    original_amount: 950000,
    current_balance: 950000,
    source_file: null,
    config: {},
  },
];

export async function seedLiabilities(sql: Sql): Promise<number> {
  let inserted = 0;

  for (const liability of LIABILITIES) {
    const result = await sql`
      INSERT INTO liability (entity_code, name, type, status, original_amount, current_balance, source_file, config)
      VALUES (
        ${liability.entity_code},
        ${liability.name},
        ${liability.type},
        ${liability.status},
        ${liability.original_amount},
        ${liability.current_balance},
        ${liability.source_file},
        ${JSON.stringify(liability.config)}
      )
      ON CONFLICT (entity_code, name) DO UPDATE SET
        source_file = COALESCE(liability.source_file, EXCLUDED.source_file)
    `;
    inserted += result.count;
  }

  return inserted;
}

export { LIABILITIES };
