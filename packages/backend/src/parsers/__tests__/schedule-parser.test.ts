import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseScheduleExcel } from "../schedule-parser-excel.js";
import { parseSchedulePdf } from "../schedule-parser-pdf.js";
import { ScheduleParseError } from "../schedule-types.js";

const ZASOBY_DIR = join(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "..",
  "zasoby",
  "zaobowiazania",
);

function loadFile(name: string): Buffer {
  return readFileSync(join(ZASOBY_DIR, name));
}

describe("parseScheduleExcel", () => {
  it("parses tabela_rat_364944.xlsx into installments with capital and interest", () => {
    const buffer = loadFile("tabela_rat_364944.xlsx");
    const result = parseScheduleExcel(buffer, "tabela_rat_364944.xlsx");

    expect(result.sourceFile).toBe("tabela_rat_364944.xlsx");
    expect(result.entries.length).toBeGreaterThan(0);

    // Check first regular installment has required fields
    const firstRegular = result.entries.find((e) => e.installmentNumber === 1);
    expect(firstRegular).toBeDefined();
    if (firstRegular) {
      expect(firstRegular.capital).toBeGreaterThan(0);
      expect(firstRegular.interest).toBeGreaterThan(0);
      expect(firstRegular.total).toBeGreaterThan(0);
      // total should roughly equal capital + interest
      expect(
        Math.abs(firstRegular.total - (firstRegular.capital + firstRegular.interest)),
      ).toBeLessThan(0.1);
    }
  });

  it("parses EFL files", () => {
    const buffer = loadFile("harmonogram_splat_EFL_6F01694.xlsx");
    const result = parseScheduleExcel(buffer, "harmonogram_splat_EFL_6F01694.xlsx");

    expect(result.entries.length).toBeGreaterThan(0);

    // EFL files have dates as strings "YYYY-MM-DD"
    const first = result.entries[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.paymentDate).toBeInstanceOf(Date);
      expect(first.capital).toBeGreaterThan(0);
    }
  });

  it("parses Santander file with dates", () => {
    const buffer = loadFile("harmonogram_santander_NP6_00258_2023.xlsx");
    const result = parseScheduleExcel(
      buffer,
      "harmonogram_santander_NP6_00258_2023.xlsx",
    );

    expect(result.entries.length).toBeGreaterThan(0);
    const first = result.entries[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.paymentDate).toBeInstanceOf(Date);
    }
  });

  it("parses Mercedes Excel file", () => {
    const buffer = loadFile("Harmonogram_platnosci-dndgr-mercedes.xlsx");
    const result = parseScheduleExcel(
      buffer,
      "Harmonogram_platnosci-dndgr-mercedes.xlsx",
    );

    expect(result.entries.length).toBeGreaterThan(0);
    const first = result.entries[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.total).toBeGreaterThan(0);
    }
  });

  it("parses TDM leasing file", () => {
    const buffer = loadFile("TDM-leas.xlsx");
    const result = parseScheduleExcel(buffer, "TDM-leas.xlsx");

    expect(result.entries.length).toBeGreaterThan(0);
    const first = result.entries[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.capital).toBeGreaterThan(0);
      expect(first.paymentDate).toBeInstanceOf(Date);
    }
  });

  it("throws for file with missing columns", () => {
    const XLSX = require("xlsx");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["Empty sheet"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    expect(() =>
      parseScheduleExcel(buffer, "harmonogram_splat_EFL_6F01694.xlsx"),
    ).toThrow(ScheduleParseError);
  });
});

describe("parseSchedulePdf", () => {
  it("parses Harmonogram.pdf (Alior) into installments", async () => {
    const buffer = loadFile("Harmonogram.pdf");
    const result = await parseSchedulePdf(buffer, "Harmonogram.pdf");

    expect(result.sourceFile).toBe("Harmonogram.pdf");
    expect(result.entries.length).toBeGreaterThan(0);

    const first = result.entries[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.paymentDate).toBeInstanceOf(Date);
      expect(first.total).toBeGreaterThan(0);
    }
  });

  it("throws ScheduleParseError for LFR.pdf (scan)", async () => {
    const buffer = loadFile("LFR.pdf");

    await expect(
      parseSchedulePdf(buffer, "LFR.pdf"),
    ).rejects.toThrow(ScheduleParseError);

    await expect(
      parseSchedulePdf(buffer, "LFR.pdf"),
    ).rejects.toThrow("Skan PDF, wymaga ręcznego wpisu");
  });

  it("parses PKO Leasing PDF", async () => {
    const buffer = loadFile("Harmonogram spłat_nr umowy 01450_PI_24.pdf");
    const result = await parseSchedulePdf(
      buffer,
      "Harmonogram spłat_nr umowy 01450_PI_24.pdf",
    );

    expect(result.entries.length).toBeGreaterThan(0);
    const first = result.entries[0];
    expect(first).toBeDefined();
    if (first) {
      expect(first.total).toBeGreaterThan(0);
    }
  });

  it("sums of installments are reasonable", async () => {
    const buffer = loadFile("Harmonogram.pdf");
    const result = await parseSchedulePdf(buffer, "Harmonogram.pdf");

    const totalCapital = result.entries.reduce((s, e) => s + e.capital, 0);
    // Alior Bank loan is 500,000 PLN
    // Total capital should be around that amount
    expect(totalCapital).toBeGreaterThan(100000);
    expect(totalCapital).toBeLessThan(600000);
  });
});
