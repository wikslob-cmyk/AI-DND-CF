import fs from "node:fs";
import path from "node:path";
import type { Sql } from "postgres";

const MIGRATIONS_DIR = path.resolve(
  import.meta.dirname,
  "migrations",
);

export async function runMigrations(sql: Sql): Promise<string[]> {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const applied = await sql<{ name: string }[]>`
    SELECT name FROM _migrations ORDER BY id
  `;
  const appliedNames = new Set(applied.map((r) => r.name));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const newMigrations: string[] = [];

  for (const file of files) {
    if (appliedNames.has(file)) {
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sqlContent = fs.readFileSync(filePath, "utf-8");

    await sql.begin(async (tx) => {
      await tx.unsafe(sqlContent);
      await tx`INSERT INTO _migrations (name) VALUES (${file})`;
    });

    newMigrations.push(file);
  }

  return newMigrations;
}
