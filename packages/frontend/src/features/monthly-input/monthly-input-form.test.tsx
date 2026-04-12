import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MonthlyInputForm } from "./monthly-input-form";

vi.mock("@/lib/api-client", () => ({
  api: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue({}),
  },
}));

function renderForm(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MonthlyInputForm />
    </QueryClientProvider>,
  );
}

describe("MonthlyInputForm", () => {
  it("renders year and month selectors", () => {
    renderForm();
    expect(screen.getByLabelText("Rok")).toBeDefined();
    expect(screen.getByLabelText("Miesiac")).toBeDefined();
  });

  it("renders entity form cards for all 5 entities", () => {
    renderForm();
    expect(screen.getByText("CGE Sp. z o.o.")).toBeDefined();
    expect(screen.getByText("DND Group Sp. z o.o.")).toBeDefined();
    expect(screen.getByText("DND Sp. z o.o.")).toBeDefined();
    expect(screen.getByText("TDM Sp. z o.o.")).toBeDefined();
    expect(screen.getByText("TDP Sp. z o.o.")).toBeDefined();
  });

  it("renders save buttons for each entity", () => {
    renderForm();
    const buttons = screen.getAllByRole("button", { name: "Zapisz" });
    expect(buttons).toHaveLength(5);
  });
});
