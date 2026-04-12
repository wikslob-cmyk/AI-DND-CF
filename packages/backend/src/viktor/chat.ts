import Anthropic from "@anthropic-ai/sdk";
import type { FastifyBaseLogger } from "fastify";
import { SYSTEM_PROMPT } from "./system-prompt.js";
import { TOOL_DEFINITIONS, executeTool } from "./tools.js";
import { selectModel } from "./model-router.js";

// Pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-haiku-4-20250414": { input: 0.25, output: 1.25 },
};

const MONTHLY_COST_WARNING_USD = 20;
const TOOL_ERROR_FALLBACK =
  "Przepraszam, nie moge teraz pobrac danych. Sprobuj ponownie.";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface CostEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: Date;
}

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? { input: 3, output: 15 };
  return (
    (inputTokens * pricing.input) / 1_000_000 +
    (outputTokens * pricing.output) / 1_000_000
  );
}

let cachedClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }

  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export async function* streamChat(
  messages: ChatMessage[],
  logger: FastifyBaseLogger,
): AsyncGenerator<string, CostEntry> {
  const client = getAnthropicClient();
  const lastUserMessage =
    messages.filter((m) => m.role === "user").pop()?.content ?? "";
  const model = selectModel(lastUserMessage);

  logger.info({ model, messageCount: messages.length }, "Viktor chat request");

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Function calling loop (max 5 tool rounds)
  const MAX_TOOL_ROUNDS = 5;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages: anthropicMessages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Check if response has tool use
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );

    // Yield any intermediate text
    for (const textBlock of textBlocks) {
      if (textBlock.text) {
        yield textBlock.text;
      }
    }

    if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
      // No tool calls, we're done
      break;
    }

    // Execute tools and add results to conversation
    anthropicMessages.push({
      role: "assistant",
      content: response.content,
    });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      logger.info(
        { tool: toolUse.name, input: toolUse.input },
        "Viktor tool call",
      );

      let result: string;
      try {
        result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
        );
      } catch (err) {
        logger.error(
          { tool: toolUse.name, error: err },
          "Viktor tool execution error",
        );
        result = JSON.stringify({ error: TOOL_ERROR_FALLBACK });
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    anthropicMessages.push({
      role: "user",
      content: toolResults,
    });
  }

  const costUsd = calculateCost(model, totalInputTokens, totalOutputTokens);

  const costEntry: CostEntry = {
    model,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    costUsd,
    timestamp: new Date(),
  };

  logger.info(
    {
      model: costEntry.model,
      inputTokens: costEntry.inputTokens,
      outputTokens: costEntry.outputTokens,
      costUsd: costEntry.costUsd.toFixed(6),
    },
    "Viktor chat cost",
  );

  if (costUsd > MONTHLY_COST_WARNING_USD / 30) {
    logger.warn(
      { costUsd: costUsd.toFixed(6), dailyBudget: (MONTHLY_COST_WARNING_USD / 30).toFixed(4) },
      "Viktor chat: koszt bliski dziennemu limitowi",
    );
  }

  return costEntry;
}

export type { ChatMessage, CostEntry };
