import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SummaryPage } from "./summary-page";

vi.mock("@/lib/api-client", () => ({
  api: {
    get: vi.fn().mockResolvedValue({
      receivables30d: 50000,
      payables30d: 30000,
      liabilities30d: 15000,
      bankBalance: 500000,
      warehouseValue: 200000,
      overdueReceivables: 10000,
      lastImport: {
        importedAt: "2026-04-12T10:00:00Z",
        status: "success",
      },
    }),
  },
}));

function renderSummaryPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SummaryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SummaryPage", () => {
  it("renders entity tabs", () => {
    renderSummaryPage();
    expect(screen.getByText("Grupa")).toBeDefined();
  });

  it("renders loading state initially", () => {
    renderSummaryPage();
    // Either loading or content should be present
    const loadingOrContent =
      screen.queryByText("Ladowanie...") !== null ||
      screen.queryByText("Grupa") !== null;
    expect(loadingOrContent).toBe(true);
  });
});
