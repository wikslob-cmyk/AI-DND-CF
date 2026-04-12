import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ViktorChat } from "./viktor-chat";

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe("ViktorChat", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("renders chat container with header and empty state", () => {
    render(<ViktorChat />);

    expect(screen.getByTestId("viktor-chat")).toBeDefined();
    expect(screen.getByText("Viktor AI")).toBeDefined();
    expect(screen.getByText("Asystent finansowy grupy DND")).toBeDefined();
    expect(screen.getByText("Zadaj pytanie o finanse grupy...")).toBeDefined();
  });

  it("renders input field and send button", () => {
    render(<ViktorChat />);

    const input = screen.getByTestId("viktor-input");
    expect(input).toBeDefined();
    expect(input.getAttribute("placeholder")).toBe("Zapytaj Viktora...");

    const sendButton = screen.getByTestId("viktor-send");
    expect(sendButton).toBeDefined();
    expect(sendButton.textContent).toBe("Wyslij");
  });

  it("disables send button when input is empty", () => {
    render(<ViktorChat />);

    const sendButton = screen.getByTestId("viktor-send") as HTMLButtonElement;
    expect(sendButton.disabled).toBe(true);
  });

  it("enables send button when input has text", () => {
    render(<ViktorChat />);

    const input = screen.getByTestId("viktor-input");
    fireEvent.change(input, { target: { value: "Ile mamy naleznosci?" } });

    const sendButton = screen.getByTestId("viktor-send") as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
  });
});
