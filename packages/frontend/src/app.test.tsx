import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginPage } from "./features/auth/login-page";

function renderWithProviders(ui: React.ReactElement): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("App", () => {
  it("should render the login page title", () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText("Dashboard Finansowy")).toBeDefined();
  });

  it("should render the login form with password field", () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByLabelText("Haslo")).toBeDefined();
  });

  it("should render the submit button", () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole("button", { name: "Zaloguj" })).toBeDefined();
  });
});
