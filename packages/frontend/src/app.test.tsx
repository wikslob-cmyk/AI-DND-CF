import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./app";

describe("App", () => {
  it("should render the dashboard title", () => {
    render(<App />);

    expect(screen.getByText("Dashboard Finansowy")).toBeDefined();
  });

  it("should render the group name", () => {
    render(<App />);

    expect(screen.getByText("Grupa DND")).toBeDefined();
  });
});
