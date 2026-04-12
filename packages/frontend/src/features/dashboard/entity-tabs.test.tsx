import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EntityTabs } from "./entity-tabs";

describe("EntityTabs", () => {
  it("renders all entity tabs including 'Grupa'", () => {
    const onEntityChange = vi.fn();
    render(
      <EntityTabs activeEntity="all" onEntityChange={onEntityChange}>
        {() => <div>Content</div>}
      </EntityTabs>,
    );

    expect(screen.getByText("Grupa")).toBeDefined();
    expect(screen.getByText("CGE")).toBeDefined();
    expect(screen.getByText("DND Group")).toBeDefined();
    expect(screen.getByText("DND")).toBeDefined();
    expect(screen.getByText("TDM")).toBeDefined();
    expect(screen.getByText("TDP")).toBeDefined();
  });

  it("renders children content", () => {
    const onEntityChange = vi.fn();
    render(
      <EntityTabs activeEntity="all" onEntityChange={onEntityChange}>
        {() => <div data-testid="tab-content">Test content</div>}
      </EntityTabs>,
    );

    expect(screen.getByTestId("tab-content")).toBeDefined();
  });
});
