import { describe, it, expect } from "vitest";
import { normalizeNip, isValidNip } from "../nip-normalizer.js";

describe("normalizeNip", () => {
  it("removes dashes from NIP", () => {
    expect(normalizeNip("123-456-78-90")).toBe("1234567890");
  });

  it("removes PL prefix", () => {
    expect(normalizeNip("PL1234567890")).toBe("1234567890");
  });

  it("removes PL prefix case-insensitive", () => {
    expect(normalizeNip("pl1234567890")).toBe("1234567890");
  });

  it("removes spaces", () => {
    expect(normalizeNip("123 456 78 90")).toBe("1234567890");
  });

  it("handles combined formatting", () => {
    expect(normalizeNip("PL 123-456-78-90")).toBe("1234567890");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeNip("")).toBe("");
  });

  it("returns empty string for null-like input", () => {
    expect(normalizeNip(undefined as unknown as string)).toBe("");
  });

  it("passes through clean NIP unchanged", () => {
    expect(normalizeNip("1234567890")).toBe("1234567890");
  });
});

describe("isValidNip", () => {
  it("returns true for 10-digit NIP", () => {
    expect(isValidNip("1234567890")).toBe(true);
  });

  it("returns false for too short NIP", () => {
    expect(isValidNip("123456789")).toBe(false);
  });

  it("returns false for too long NIP", () => {
    expect(isValidNip("12345678901")).toBe(false);
  });

  it("returns false for non-numeric NIP", () => {
    expect(isValidNip("123456789A")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidNip("")).toBe(false);
  });
});
