import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockExecuteTool = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock("../tools.js", () => ({
  TOOL_DEFINITIONS: [{ name: "get_receivables", description: "test", input_schema: { type: "object", properties: {}, required: [] } }],
  executeTool: (...args: unknown[]) => mockExecuteTool(...args),
}));

vi.mock("../model-router.js", () => ({
  selectModel: vi.fn().mockReturnValue("claude-haiku-4-20250414"),
}));

vi.mock("../system-prompt.js", () => ({
  SYSTEM_PROMPT: "Test system prompt",
}));

import { streamChat } from "../chat.js";

async function drainGenerator(
  gen: AsyncGenerator<string, unknown>,
): Promise<{ chunks: string[]; returnValue: unknown }> {
  const chunks: string[] = [];
  let result = await gen.next();
  while (!result.done) {
    chunks.push(result.value);
    result = await gen.next();
  }
  return { chunks, returnValue: result.value };
}

describe("streamChat", () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key-for-mock";
  });

  it("returns text response and calculates cost correctly", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Naleznosci wynoszą 50 000 PLN" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1000, output_tokens: 200 },
    });

    const gen = streamChat(
      [{ role: "user", content: "ile mamy naleznosci?" }],
      mockLogger as never,
    );

    const { chunks, returnValue } = await drainGenerator(gen);

    expect(chunks).toContain("Naleznosci wynoszą 50 000 PLN");

    const cost = returnValue as {
      model: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
    };
    expect(cost.model).toBe("claude-haiku-4-20250414");
    expect(cost.inputTokens).toBe(1000);
    expect(cost.outputTokens).toBe(200);
    // Haiku: (1000 * 0.25 / 1_000_000) + (200 * 1.25 / 1_000_000) = 0.0005
    expect(cost.costUsd).toBeCloseTo(0.0005, 6);
  });

  it("executes function calling loop and returns combined result", async () => {
    // First call: model requests tool use
    mockCreate.mockResolvedValueOnce({
      content: [
        { type: "text", text: "Pobieram dane..." },
        {
          type: "tool_use",
          id: "tool_1",
          name: "get_receivables",
          input: { entity: "all", period: "7d" },
        },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 500, output_tokens: 100 },
    });

    mockExecuteTool.mockResolvedValueOnce(
      JSON.stringify({ totalPln: 50000, groups: [] }),
    );

    // Second call: model returns final text after tool result
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Naleznosci: 50 000 PLN" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 800, output_tokens: 150 },
    });

    const gen = streamChat(
      [{ role: "user", content: "ile mamy naleznosci?" }],
      mockLogger as never,
    );

    const { chunks, returnValue } = await drainGenerator(gen);

    expect(chunks).toContain("Pobieram dane...");
    expect(chunks).toContain("Naleznosci: 50 000 PLN");
    expect(mockExecuteTool).toHaveBeenCalledWith("get_receivables", {
      entity: "all",
      period: "7d",
    });

    const cost = returnValue as { inputTokens: number; outputTokens: number };
    expect(cost.inputTokens).toBe(1300);
    expect(cost.outputTokens).toBe(250);
  });

  it("handles tool execution error with fallback message", async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          id: "tool_1",
          name: "get_receivables",
          input: { entity: "all" },
        },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 500, output_tokens: 50 },
    });

    mockExecuteTool.mockRejectedValueOnce(new Error("DB connection failed"));

    mockCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "Przepraszam, dane niedostepne." }],
      stop_reason: "end_turn",
      usage: { input_tokens: 600, output_tokens: 80 },
    });

    const gen = streamChat(
      [{ role: "user", content: "naleznosci" }],
      mockLogger as never,
    );

    const { chunks } = await drainGenerator(gen);

    expect(chunks).toContain("Przepraszam, dane niedostepne.");
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it("respects max 5 tool rounds limit", async () => {
    // Simulate 5 rounds of tool use followed by end
    for (let i = 0; i < 5; i++) {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: `tool_${i}`,
            name: "get_receivables",
            input: { entity: "all" },
          },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 100, output_tokens: 50 },
      });
      mockExecuteTool.mockResolvedValueOnce(JSON.stringify({ data: "ok" }));
    }

    const gen = streamChat(
      [{ role: "user", content: "test" }],
      mockLogger as never,
    );

    const { returnValue } = await drainGenerator(gen);

    // Should have made exactly 5 API calls (max rounds)
    expect(mockCreate).toHaveBeenCalledTimes(5);

    const cost = returnValue as { inputTokens: number; outputTokens: number };
    expect(cost.inputTokens).toBe(500);
    expect(cost.outputTokens).toBe(250);
  });
});
