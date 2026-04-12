import type { Sql } from "postgres";

interface EntitySeed {
  code: string;
  name: string;
  has_warehouse: boolean;
}

const ENTITIES: EntitySeed[] = [
  { code: "cgesp", name: "CGE Sp. z o.o.", has_warehouse: false },
  { code: "dngro", name: "DND Group Sp. z o.o.", has_warehouse: true },
  { code: "dndsp", name: "DND Sp. z o.o.", has_warehouse: false },
  { code: "tdmsp", name: "TDM Sp. z o.o.", has_warehouse: false },
  { code: "tdpsp", name: "TDP Sp. z o.o.", has_warehouse: false },
];

export async function seedEntities(sql: Sql): Promise<number> {
  let inserted = 0;

  for (const entity of ENTITIES) {
    const result = await sql`
      INSERT INTO entity (code, name, has_warehouse)
      VALUES (${entity.code}, ${entity.name}, ${entity.has_warehouse})
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        has_warehouse = EXCLUDED.has_warehouse
    `;
    inserted += result.count;
  }

  return inserted;
}

export { ENTITIES };
