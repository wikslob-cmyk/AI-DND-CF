import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ImportStatus } from "./import-status";

describe("ImportStatus", () => {
  it("shows empty state when lastImport is null", () => {
    render(<ImportStatus status={{ lastImport: null }} />);

    expect(
      screen.getByText("Brak danych o ostatnim imporcie"),
    ).toBeDefined();
  });

  it("shows success status with file names", () => {
    render(
      <ImportStatus
        status={{
          lastImport: {
            importedAt: "2026-04-12T10:00:00Z",
            status: "success",
            files: ["lista-dokumentow-cgesp.xlsx"],
            warnings: [],
            errors: [],
          },
        }}
      />,
    );

    expect(screen.getByText("Import zakończony")).toBeDefined();
    expect(
      screen.getByText("lista-dokumentow-cgesp.xlsx"),
    ).toBeDefined();
  });

  it("shows failed status with error messages", () => {
    render(
      <ImportStatus
        status={{
          lastImport: {
            importedAt: "2026-04-12T10:00:00Z",
            status: "failed",
            files: ["broken.xlsx"],
            warnings: [],
            errors: ["Plik uszkodzony"],
          },
        }}
      />,
    );

    expect(screen.getByText("Import nieudany")).toBeDefined();
    expect(screen.getByText("Plik uszkodzony")).toBeDefined();
  });

  it("shows warnings when present", () => {
    render(
      <ImportStatus
        status={{
          lastImport: {
            importedAt: "2026-04-12T10:00:00Z",
            status: "success",
            files: ["test.xlsx"],
            warnings: ["LFR.pdf: Skan PDF, wymaga ręcznego wpisu"],
            errors: [],
          },
        }}
      />,
    );

    expect(
      screen.getByText("LFR.pdf: Skan PDF, wymaga ręcznego wpisu"),
    ).toBeDefined();
  });
});
