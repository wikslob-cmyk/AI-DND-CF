import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "./message-bubble";

describe("MessageBubble", () => {
  it("renders user message with correct content and test id", () => {
    render(<MessageBubble role="user" content="Ile mamy naleznosci?" />);

    const bubble = screen.getByTestId("message-user");
    expect(bubble).toBeDefined();
    expect(bubble.textContent).toContain("Ile mamy naleznosci?");
  });

  it("renders assistant message with Viktor label", () => {
    render(
      <MessageBubble role="assistant" content="Naleznosci wynoszą 50 000 PLN" />,
    );

    const bubble = screen.getByTestId("message-assistant");
    expect(bubble).toBeDefined();
    expect(bubble.textContent).toContain("Viktor");
    expect(bubble.textContent).toContain("Naleznosci wynoszą 50 000 PLN");
  });

  it("does not render Viktor label for user messages", () => {
    render(<MessageBubble role="user" content="Test" />);

    const bubble = screen.getByTestId("message-user");
    expect(bubble.textContent).not.toContain("Viktor");
  });
});
