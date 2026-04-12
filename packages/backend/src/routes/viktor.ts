import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { authMiddleware } from "../auth/middleware.js";
import { streamChat, type ChatMessage } from "../viktor/chat.js";

interface ChatBody {
  messages: ChatMessage[];
}

const CHAT_BODY_SCHEMA = {
  type: "object" as const,
  required: ["messages"],
  properties: {
    messages: {
      type: "array" as const,
      minItems: 1,
      maxItems: 50,
      items: {
        type: "object" as const,
        required: ["role", "content"],
        properties: {
          role: { type: "string" as const, enum: ["user", "assistant"] },
          content: { type: "string" as const, minLength: 1, maxLength: 10000 },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: false,
};

export async function registerViktorRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("onRequest", authMiddleware);

  app.post(
    "/api/viktor/chat",
    {
      schema: {
        body: CHAT_BODY_SCHEMA,
      },
    },
    async (
      request: FastifyRequest<{ Body: ChatBody }>,
      reply: FastifyReply,
    ) => {
      const { messages } = request.body;

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      try {
        const generator = streamChat(messages, request.log);
        let result = await generator.next();

        while (!result.done) {
          const chunk = result.value;
          reply.raw.write(`data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`);
          result = await generator.next();
        }

        // Final message with cost info
        const costEntry = result.value;
        reply.raw.write(
          `data: ${JSON.stringify({ type: "done", cost: { model: costEntry.model, inputTokens: costEntry.inputTokens, outputTokens: costEntry.outputTokens, costUsd: costEntry.costUsd } })}\n\n`,
        );
      } catch (err) {
        request.log.error({ error: err }, "Viktor chat stream error");
        reply.raw.write(
          `data: ${JSON.stringify({ type: "error", message: "Wystapil blad podczas przetwarzania zapytania" })}\n\n`,
        );
      } finally {
        reply.raw.end();
      }

      return reply;
    },
  );
}
