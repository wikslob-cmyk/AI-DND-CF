import { useState, useRef, useEffect, useCallback } from "react";
import { MessageBubble } from "./message-bubble";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SseEvent {
  type: "text" | "done" | "error";
  content?: string;
  message?: string;
  cost?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
}

export function ViktorChat(): React.ReactNode {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/viktor/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({
          error: { message: response.statusText },
        }));
        throw new Error(
          errBody.error?.message ?? `Blad ${response.status}`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Brak strumienia odpowiedzi");
      }

      const decoder = new TextDecoder();
      let assistantContent = "";

      // Add empty assistant message placeholder
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      let buffer = "";
      let isDone = false;

      while (!isDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data: ")) continue;

          const jsonStr = trimmedLine.slice(6);
          let event: SseEvent;
          try {
            event = JSON.parse(jsonStr) as SseEvent;
          } catch {
            continue;
          }

          if (event.type === "text" && event.content) {
            assistantContent += event.content;
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx]?.role === "assistant") {
                updated[lastIdx] = {
                  role: "assistant",
                  content: assistantContent,
                };
              }
              return updated;
            });
          } else if (event.type === "done") {
            isDone = true;
          } else if (event.type === "error") {
            assistantContent =
              event.message ?? "Wystapil blad. Sprobuj ponownie.";
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx]?.role === "assistant") {
                updated[lastIdx] = {
                  role: "assistant",
                  content: assistantContent,
                };
              }
              return updated;
            });
            isDone = true;
          }
        }
      }
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Nieznany blad";
      setMessages((prev) => [
        ...prev.filter((m) => m.role !== "assistant" || m.content !== ""),
        { role: "assistant", content: `Blad: ${errorMsg}` },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  return (
    <div
      className="flex h-full flex-col rounded-lg border border-gray-200 bg-white"
      data-testid="viktor-chat"
    >
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-gray-900">
          Viktor AI
        </h2>
        <p className="text-xs text-gray-500">
          Asystent finansowy grupy DND
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-8">
            Zadaj pytanie o finanse grupy...
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageBubble
              key={idx}
              role={msg.role}
              content={msg.content}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Zapytaj Viktora..."
            disabled={isLoading}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
            data-testid="viktor-input"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            data-testid="viktor-send"
          >
            {isLoading ? "..." : "Wyslij"}
          </button>
        </div>
      </div>
    </div>
  );
}
