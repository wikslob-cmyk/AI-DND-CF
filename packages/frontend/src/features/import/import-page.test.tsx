import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImportPage } from "./import-page";

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("ImportPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  it("renders all three import sections", () => {
    render(<ImportPage />);

    expect(screen.getByText("Import danych")).toBeDefined();
    expect(screen.getByText("Pliki Saldeo (faktury)")).toBeDefined();
    expect(screen.getByText("Zestawienie magazynowe")).toBeDefined();
    expect(screen.getByText("Harmonogramy zobowiązań")).toBeDefined();
  });

  it("renders import buttons in disabled state when no files selected", () => {
    render(<ImportPage />);

    const saldeoButton = screen.getByText("Importuj Saldeo");
    const warehouseButton = screen.getByText("Importuj magazyn");
    const schedulesButton = screen.getByText("Importuj harmonogramy");

    expect(saldeoButton).toBeDefined();
    expect(warehouseButton).toBeDefined();
    expect(schedulesButton).toBeDefined();

    expect(saldeoButton.hasAttribute("disabled")).toBe(true);
    expect(warehouseButton.hasAttribute("disabled")).toBe(true);
    expect(schedulesButton.hasAttribute("disabled")).toBe(true);
  });

  it("shows error status when upload fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    render(<ImportPage />);

    // Simulate file selection via the dropzone input
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const saldeoInput = fileInputs[0] as HTMLInputElement;

    const file = new File(["content"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    fireEvent.change(saldeoInput, { target: { files: [file] } });

    const importButton = screen.getByText("Importuj Saldeo");
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByText("Import nieudany")).toBeDefined();
    });

    expect(screen.getByText("Network error")).toBeDefined();
  });
});
