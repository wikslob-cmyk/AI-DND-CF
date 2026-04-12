import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { runMigrations } from "../migrate.js";
import { seedEntities, ENTITIES } from "../seed-entities.js";
import { seedLiabilities, LIABILITIES } from "../seed-liabilities.js";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  "postgres://dashboard:dashboard@localhost:5432/dashboard_test";

let sql: ReturnType<typeof postgres>;

function isDbAvailable(): boolean {
  return process.env.CI === "true" || process.env.TEST_DATABASE_URL !== undefined || process.env.RUN_DB_TESTS === "true";
}

describe("Database migrations", () => {
  describe("Migration files", () => {
    it("should have 001-initial-schema.sql migration file", () => {
      const migrationsDir = path.resolve(
        import.meta.dirname,
        "..",
        "migrations",
      );
      const files = fs.readdirSync(migrationsDir);
      expect(files).toContain("001-initial-schema.sql");
    });

    it("should have valid SQL in migration file", () => {
      const filePath = path.resolve(
        import.meta.dirname,
        "..",
        "migrations",
        "001-initial-schema.sql",
      );
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("CREATE TABLE IF NOT EXISTS entity");
      expect(content).toContain("CREATE TABLE IF NOT EXISTS import_log");
      expect(content).toContain("CREATE TABLE IF NOT EXISTS invoice");
      expect(content).toContain("CREATE TABLE IF NOT EXISTS exchange_rate");
      expect(content).toContain("CREATE TABLE IF NOT EXISTS liability");
      expect(content).toContain("CREATE TABLE IF NOT EXISTS liability_schedule");
      expect(content).toContain("CREATE TABLE IF NOT EXISTS warehouse_item");
      expect(content).toContain("CREATE TABLE IF NOT EXISTS monthly_input");
    });

    it("should create indexes in migration", () => {
      const filePath = path.resolve(
        import.meta.dirname,
        "..",
        "migrations",
        "001-initial-schema.sql",
      );
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("idx_invoice_entity_type_due");
      expect(content).toContain("idx_invoice_contractor_nip");
      expect(content).toContain("idx_liability_schedule_liability_date");
      expect(content).toContain("idx_monthly_input_entity_period");
    });

    it("should have UNIQUE constraint on monthly_input", () => {
      const filePath = path.resolve(
        import.meta.dirname,
        "..",
        "migrations",
        "001-initial-schema.sql",
      );
      const content = fs.readFileSync(filePath, "utf-8");

      expect(content).toContain("UNIQUE (entity_code, year, month)");
    });
  });

  describe("Seed data", () => {
    it("should define 5 entities", () => {
      expect(ENTITIES).toHaveLength(5);
      const codes = ENTITIES.map((e) => e.code);
      expect(codes).toContain("cgesp");
      expect(codes).toContain("dngro");
      expect(codes).toContain("dndsp");
      expect(codes).toContain("tdmsp");
      expect(codes).toContain("tdpsp");
    });

    it("should mark only dngro as having warehouse", () => {
      const withWarehouse = ENTITIES.filter((e) => e.has_warehouse);
      expect(withWarehouse).toHaveLength(1);
      expect(withWarehouse[0]?.code).toBe("dngro");
    });

    it("should define liability seed data with correct count", () => {
      expect(LIABILITIES.length).toBeGreaterThanOrEqual(15);
    });

    it("should have ING limit and faktoring as rolling", () => {
      const ingLimit = LIABILITIES.find((l) => l.name === "ING - limit");
      const ingFaktoring = LIABILITIES.find(
        (l) => l.name === "ING - faktoring",
      );

      expect(ingLimit).toBeDefined();
      expect(ingLimit?.config).toEqual({
        monthly_capital: 70000,
        monthly_interest: 18000,
        rolling: true,
      });

      expect(ingFaktoring).toBeDefined();
      expect(ingFaktoring?.config).toEqual({
        monthly_capital: 0,
        monthly_interest: 15000,
        rolling: true,
      });
    });

    it("should have informational positions (ISAG, NCBiR, PARP)", () => {
      const infoItems = LIABILITIES.filter(
        (l) => l.type === "info" || l.status === "informational" || l.status === "pending_write_off",
      );
      const names = infoItems.map((l) => l.name);

      expect(names).toContain("ISAG (IKEA)");
      expect(names).toContain("NCBiR 750 000 PLN");
      expect(names).toContain("NCBiR 3 200 000 PLN");
      expect(names).toContain("PARP 950 000 PLN");
    });
  });

  describe.skipIf(!isDbAvailable())("Database integration", () => {
    beforeAll(async () => {
      sql = postgres(TEST_DB_URL, { max: 3 });
      // Clean slate
      await sql.unsafe(`
        DROP TABLE IF EXISTS liability_schedule CASCADE;
        DROP TABLE IF EXISTS warehouse_item CASCADE;
        DROP TABLE IF EXISTS invoice CASCADE;
        DROP TABLE IF EXISTS exchange_rate CASCADE;
        DROP TABLE IF EXISTS monthly_input CASCADE;
        DROP TABLE IF EXISTS liability CASCADE;
        DROP TABLE IF EXISTS import_log CASCADE;
        DROP TABLE IF EXISTS entity CASCADE;
        DROP TABLE IF EXISTS _migrations CASCADE;
      `);
    });

    afterAll(async () => {
      if (sql) {
        await sql.end();
      }
    });

    it("should run migrations and create all tables", async () => {
      const applied = await runMigrations(sql);
      expect(applied).toContain("001-initial-schema.sql");

      const tables = await sql`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        ORDER BY tablename
      `;
      const tableNames = tables.map((t) => t.tablename);

      expect(tableNames).toContain("entity");
      expect(tableNames).toContain("import_log");
      expect(tableNames).toContain("invoice");
      expect(tableNames).toContain("exchange_rate");
      expect(tableNames).toContain("liability");
      expect(tableNames).toContain("liability_schedule");
      expect(tableNames).toContain("warehouse_item");
      expect(tableNames).toContain("monthly_input");
      expect(tableNames).toContain("_migrations");
    });

    it("should seed 5 entities", async () => {
      await seedEntities(sql);
      const entities = await sql`SELECT * FROM entity ORDER BY code`;
      expect(entities).toHaveLength(5);
    });

    it("should seed liability data", async () => {
      const count = await seedLiabilities(sql);
      expect(count).toBeGreaterThanOrEqual(15);
      const liabilities = await sql`SELECT * FROM liability`;
      expect(liabilities.length).toBeGreaterThanOrEqual(15);
    });

    it("should be idempotent on re-run", async () => {
      const applied = await runMigrations(sql);
      expect(applied).toHaveLength(0);
    });

    it("should enforce UNIQUE constraint on monthly_input", async () => {
      await sql`
        INSERT INTO monthly_input (entity_code, year, month, vat_refund, salaries_net, bank_balance)
        VALUES ('cgesp', 2026, 4, 5000, 20000, 150000)
      `;

      await expect(
        sql`
          INSERT INTO monthly_input (entity_code, year, month, vat_refund, salaries_net, bank_balance)
          VALUES ('cgesp', 2026, 4, 6000, 21000, 160000)
        `,
      ).rejects.toThrow();
    });
  });
});
