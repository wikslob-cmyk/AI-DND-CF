import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReceivablesPage } from "./receivables-page";

vi.mock("@/lib/api-client", () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      groups: [],
      totalPln: 0,
    }),
  },
}));

function renderReceivablesPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ReceivablesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ReceivablesPage", () => {
  it("renders the page title 'Naleznosci'", () => {
    renderReceivablesPage();
    expect(screen.getByText("Naleznosci")).toBeDefined();
  });

  it("renders subtitle about FS invoices", () => {
    renderReceivablesPage();
    expect(
      screen.getByText("Faktury sprzedazy (FS) pogrupowane per kontrahent"),
    ).toBeDefined();
  });

  it("renders entity tabs", () => {
    renderReceivablesPage();
    expect(screen.getByText("Grupa")).toBeDefined();
    expect(screen.getByText("CGE")).toBeDefined();
  });
});
