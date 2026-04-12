import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseWarehouseFile } from "../warehouse-parser.js";
import { ValidationError } from "../types.js";

const ZASOBY_DIR = join(__dirname, "..", "..", "..", "..", "..", "zasoby");

describe("parseWarehouseFile", () => {
  it("parses warehouse file into items with quantities and values", () => {
    const buffer = readFileSync(
      join(ZASOBY_DIR, "Zestawienie magazynowe DND 10.04.26.xlsx"),
    );
    const result = parseWarehouseFile(
      buffer,
      "Zestawienie magazynowe DND 10.04.26.xlsx",
    );

    expect(result.items.length).toBeGreaterThan(0);

    // Check first item has required fields
    const firstWithValue = result.items.find((item) => item.valueTotal > 0);
    expect(firstWithValue).toBeDefined();
    if (firstWithValue) {
      expect(firstWithValue.articleName).toBeTruthy();
      expect(firstWithValue.quantityTotal).toBeGreaterThan(0);
      expect(firstWithValue.valueTotal).toBeGreaterThan(0);
    }
  });

  it("value per article = quantity_total * unit_price (selling price)", () => {
    const buffer = readFileSync(
      join(ZASOBY_DIR, "Zestawienie magazynowe DND 10.04.26.xlsx"),
    );
    const result = parseWarehouseFile(
      buffer,
      "Zestawienie magazynowe DND 10.04.26.xlsx",
    );

    // For items with non-zero values, check the relationship
    const itemsWithValue = result.items.filter(
      (item) => item.valueTotal > 0 && item.quantityTotal > 0 && item.unitPrice > 0,
    );
    expect(itemsWithValue.length).toBeGreaterThan(0);

    for (const item of itemsWithValue) {
      const expectedValue = item.quantityTotal * item.unitPrice;
      // Allow small floating point difference
      expect(Math.abs(item.valueTotal - expectedValue)).toBeLessThan(1);
    }
  });

  it("total value is sum of all item values", () => {
    const buffer = readFileSync(
      join(ZASOBY_DIR, "Zestawienie magazynowe DND 10.04.26.xlsx"),
    );
    const result = parseWarehouseFile(
      buffer,
      "Zestawienie magazynowe DND 10.04.26.xlsx",
    );

    const computedTotal = result.items.reduce(
      (sum, item) => sum + item.valueTotal,
      0,
    );
    expect(Math.abs(result.totalValue - computedTotal)).toBeLessThan(1);
  });

  it("extracts EUR rate from the file if present", () => {
    const buffer = readFileSync(
      join(ZASOBY_DIR, "Zestawienie magazynowe DND 10.04.26.xlsx"),
    );
    const result = parseWarehouseFile(
      buffer,
      "Zestawienie magazynowe DND 10.04.26.xlsx",
    );

    // The file has "Kurs EUR" row with value 4.22
    expect(result.eurRate).toBe(4.22);
  });

  it("throws ValidationError for invalid file format", () => {
    const XLSX = require("xlsx");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Not a warehouse file", "col2"],
      ["row1", "row2"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    expect(() =>
      parseWarehouseFile(buffer, "invalid.xlsx"),
    ).toThrow(ValidationError);
  });
});
