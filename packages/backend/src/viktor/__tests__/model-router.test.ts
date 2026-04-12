import { describe, it, expect } from "vitest";
import { selectModel, SONNET_MODEL, HAIKU_MODEL } from "../model-router.js";

describe("model-router", () => {
  it("routes 'ile mamy zobowiazan?' to Haiku", () => {
    expect(selectModel("ile mamy zobowiązań?")).toBe(HAIKU_MODEL);
  });

  it("routes 'czy grupa ma ryzyko plynnosci?' to Sonnet", () => {
    expect(selectModel("czy grupa ma ryzyko płynności?")).toBe(SONNET_MODEL);
  });

  it("routes 'prognoza na 30 dni' to Sonnet", () => {
    expect(selectModel("prognoza na 30 dni")).toBe(SONNET_MODEL);
  });

  it("routes 'cashflow grupy' to Sonnet", () => {
    expect(selectModel("cashflow grupy")).toBe(SONNET_MODEL);
  });

  it("routes 'projekcja plynnosci' to Sonnet", () => {
    expect(selectModel("projekcja plynnosci")).toBe(SONNET_MODEL);
  });

  it("routes 'analiza zobowiazan' to Sonnet", () => {
    expect(selectModel("analiza zobowiązań")).toBe(SONNET_MODEL);
  });

  it("routes 'porownaj podmioty' to Sonnet", () => {
    expect(selectModel("porównaj podmioty")).toBe(SONNET_MODEL);
  });

  it("routes 'trend wydatkow' to Sonnet", () => {
    expect(selectModel("trend wydatków")).toBe(SONNET_MODEL);
  });

  it("routes simple question to Haiku", () => {
    expect(selectModel("ile wynoszą należności CGE?")).toBe(HAIKU_MODEL);
  });

  it("routes 'podaj saldo bankowe' to Haiku", () => {
    expect(selectModel("podaj saldo bankowe")).toBe(HAIKU_MODEL);
  });

  it("routes 'jaka jest wartość magazynu?' to Haiku", () => {
    expect(selectModel("jaka jest wartość magazynu?")).toBe(HAIKU_MODEL);
  });

  it("is case insensitive", () => {
    expect(selectModel("PROGNOZA na 30 dni")).toBe(SONNET_MODEL);
    expect(selectModel("Cashflow")).toBe(SONNET_MODEL);
  });

  it("routes empty string to Haiku", () => {
    expect(selectModel("")).toBe(HAIKU_MODEL);
  });
});
