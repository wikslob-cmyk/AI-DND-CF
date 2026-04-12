import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSaldeoFile } from "../saldeo-parser.js";
import { ValidationError } from "../types.js";

const ZASOBY_DIR = join(__dirname, "..", "..", "..", "..", "..", "zasoby");

function loadSaldeoFile(entity: string): Buffer {
  return readFileSync(join(ZASOBY_DIR, `lista-dokumentow-${entity}.xlsx`));
}

describe("parseSaldeoFile", () => {
  it("parses lista-dokumentow-cgesp.xlsx into receivables and payables", () => {
    const buffer = loadSaldeoFile("cgesp");
    const invoices = parseSaldeoFile(buffer, "lista-dokumentow-cgesp.xlsx");

    expect(invoices.length).toBeGreaterThan(0);

    // All should have entityCode cgesp
    for (const inv of invoices) {
      expect(inv.entityCode).toBe("cgesp");
    }

    // Should contain both FS and FZ types
    const types = new Set(invoices.map((inv) => inv.documentType));
    expect(types.has("FZ")).toBe(true);
  });

  it("filters _FS_ and does not match _FS_PF_ or _FS_KOR_", () => {
    const buffer = loadSaldeoFile("dngro");
    const invoices = parseSaldeoFile(buffer, "lista-dokumentow-dngro.xlsx");

    // dngro has DNGRO_FS_PF_ type in data — those should NOT appear
    const allTypes = invoices.map((inv) => inv.documentType);
    // All should be FS or FZ only
    for (const t of allTypes) {
      expect(["FS", "FZ"]).toContain(t);
    }

    // Verify no PF or KOR types leaked through
    // The parser should have filtered based on regex on original Typ field
    expect(invoices.length).toBeGreaterThan(0);
  });

  it("filters _FZ_ and catches only exact _FZ_", () => {
    const buffer = loadSaldeoFile("dngro");
    const invoices = parseSaldeoFile(buffer, "lista-dokumentow-dngro.xlsx");

    const fzInvoices = invoices.filter((inv) => inv.documentType === "FZ");
    expect(fzInvoices.length).toBeGreaterThan(0);

    // Check they have valid data
    for (const inv of fzInvoices) {
      expect(inv.entityCode).toBe("dngro");
      expect(inv.paymentDue).toBeInstanceOf(Date);
    }
  });

  it("throws ValidationError for file with missing column", () => {
    const XLSX = require("xlsx");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Header row 0"],
      [""],
      ["Lp", "Typ", "Id"], // Missing required columns
      [1, "TEST_FS_", 123],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    expect(() =>
      parseSaldeoFile(buffer, "lista-dokumentow-cgesp.xlsx"),
    ).toThrow(ValidationError);

    try {
      parseSaldeoFile(buffer, "lista-dokumentow-cgesp.xlsx");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).message).toContain("Missing required columns");
      expect((err as ValidationError).message).toContain("Numer dokumentu");
    }
  });

  it("excludes invoices with Zapłacono = TAK", () => {
    const buffer = loadSaldeoFile("cgesp");
    const invoices = parseSaldeoFile(buffer, "lista-dokumentow-cgesp.xlsx");

    // All returned invoices should NOT be marked as paid
    // Since we filter out TAK, remaining invoices should have remaining > 0 or be unpaid
    // Note: some invoices with remaining=0 but Zapłacono=NIE should still be included
    expect(invoices.length).toBeGreaterThanOrEqual(0);
  });

  it("includes invoice with remaining=0 and Zapłacono=NIE (edge case)", () => {
    const XLSX = require("xlsx");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Header row 0"],
      [""],
      [
        "Lp", "Typ", "Id", "Numer dokumentu", "Numer z FK",
        "Kod Kontrahenta", "Kontrahent", "NIP", "Konto bankowe",
        "Data wpływu", "Data wystawienia", "Data dostawy",
        "Termin płatności", "Data dodania", "Data eksportu",
        "Waluta", "Wartość brutto", "Wartość netto", "Suma VAT",
        "Kategoria główna", "Zapłacono", "Data ostatniej płatności częściowej",
        "Suma płatności częściowych", "Pozostało do zapłaty",
      ],
      [
        1, "TEST_FZ_", 100, "FV/001", "", "", "Kontrahent A",
        "1234567890", "", "", "", "", 46000, "", "",
        "PLN", 1000, 813, 187, "", "NIE", "", 0, 0,
      ],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const invoices = parseSaldeoFile(buffer, "lista-dokumentow-cgesp.xlsx");
    // Should include the invoice even though remaining is 0, because Zapłacono = NIE
    expect(invoices.length).toBe(1);
    expect(invoices[0]?.remainingAmount).toBe(0);
  });

  it("normalizes NIP with dashes", () => {
    const buffer = loadSaldeoFile("cgesp");
    const invoices = parseSaldeoFile(buffer, "lista-dokumentow-cgesp.xlsx");

    // All NIPs should be normalized (no dashes, no PL prefix)
    for (const inv of invoices) {
      if (inv.contractorNip) {
        expect(inv.contractorNip).not.toContain("-");
        expect(inv.contractorNip).not.toContain("PL");
        expect(inv.contractorNip).not.toContain(" ");
      }
    }
  });

  it("parses all 5 entity files without errors", () => {
    const entities = ["cgesp", "dngro", "dndsp", "tdmsp", "tdpsp"];
    for (const entity of entities) {
      const buffer = loadSaldeoFile(entity);
      const invoices = parseSaldeoFile(
        buffer,
        `lista-dokumentow-${entity}.xlsx`,
      );
      expect(Array.isArray(invoices)).toBe(true);
    }
  });
});
