import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { LoginPage } from "./login-page";

function renderLoginPage(): void {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  it("renders the title 'Dashboard Finansowy'", () => {
    renderLoginPage();
    expect(screen.getByText("Dashboard Finansowy")).toBeDefined();
  });

  it("renders the subtitle 'Grupa DND'", () => {
    renderLoginPage();
    expect(screen.getByText("Grupa DND")).toBeDefined();
  });

  it("renders password input with label", () => {
    renderLoginPage();
    expect(screen.getByLabelText("Haslo")).toBeDefined();
  });

  it("renders submit button", () => {
    renderLoginPage();
    const button = screen.getByRole("button", { name: "Zaloguj" });
    expect(button).toBeDefined();
  });

  it("password input has type password", () => {
    renderLoginPage();
    const input = screen.getByLabelText("Haslo") as HTMLInputElement;
    expect(input.type).toBe("password");
  });
});
