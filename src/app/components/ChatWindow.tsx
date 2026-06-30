"use client";

import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/config";
import { InvestorPicker } from "./InvestorPicker";
import { Message } from "./Message";
import { Thinking } from "./Thinking";
import type { ChatMessage, InvestorSummary, ThinkingStep } from "./types";

const SUGGESTIONS = [
  "How is my portfolio doing overall?",
  "How much have I invested?",
  "Show me my Forgecraft position.",
  "What fees am I paying and are they discounted?",
  "What do I owe in upcoming calls and fees?",
  "Have I received any distributions?",
];

let idCounter = 0;
const nextId = () => `m${++idCounter}-${Date.now()}`;

function statusToStep(
  event: {
    phase: string;
    tool?: string;
    label?: string;
  },
  stepId: number
): ThinkingStep {
  const id = `s${stepId}`;
  switch (event.phase) {
    case "understanding":
      return { id, phase: "understanding", label: "Understanding your question" };
    case "tool":
      return {
        id,
        phase: "tool",
        label: event.label ?? "Calling a portfolio tool",
        tool: event.tool,
      };
    case "computing":
      return {
        id,
        phase: "computing",
        label: "Computing from portfolio data",
        tool: event.tool,
      };
    case "writing":
      return { id, phase: "writing", label: "Writing your answer" };
    default:
      return { id, phase: "understanding", label: "Working…" };
  }
}

export function ChatWindow() {
  const [investors, setInvestors] = useState<InvestorSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [liveThinking, setLiveThinking] = useState<ThinkingStep[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/investors")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setLoadError(d.error);
          return;
        }
        setInvestors(d.investors ?? []);
        if (d.investors?.length) setSelectedId(d.investors[0].investor_id);
      })
      .catch((e) => setLoadError(String(e)));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, liveThinking]);

  function handleInvestorChange(id: string) {
    setSelectedId(id);
    setMessages([]);
    setLiveThinking([]);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading || !selectedId) return;

    const userMsg: ChatMessage = { id: nextId(), role: "user", content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setLiveThinking([]);

    const startedAt = Date.now();
    const thinkingSteps: ThinkingStep[] = [];
    let stepCounter = 0;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorId: selectedId,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("ndjson")) {
        let errMsg = "Request failed.";
        try {
          const data = await res.json();
          errMsg = data.error ?? errMsg;
        } catch {}
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", content: `**Error:** ${errMsg}`, error: true },
        ]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as Record<string, unknown>;

          if (event.type === "status") {
            const step = statusToStep(
              {
                phase: String(event.phase),
                tool: event.tool != null ? String(event.tool) : undefined,
                label: event.label != null ? String(event.label) : undefined,
              },
              ++stepCounter
            );
            thinkingSteps.push(step);
            setLiveThinking([...thinkingSteps]);
          } else if (event.type === "final") {
            const durationMs = Date.now() - startedAt;
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: "assistant",
                content: String(event.reply ?? "(no response)"),
                sources: (event.sources as string[]) ?? [],
                trace: (event.trace as ChatMessage["trace"]) ?? [],
                model: event.model != null ? String(event.model) : undefined,
                thinkingSteps: [...thinkingSteps],
                thinkingDurationMs: durationMs,
              },
            ]);
          } else if (event.type === "error") {
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: "assistant",
                content: `**Error:** ${String(event.message ?? "Unexpected error.")}`,
                error: true,
                thinkingSteps: [...thinkingSteps],
                thinkingDurationMs: Date.now() - startedAt,
              },
            ]);
          }
        }
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: `**Error:** ${String(e)}`, error: true },
      ]);
    } finally {
      setLiveThinking([]);
      setLoading(false);
    }
  }

  const selected = investors.find((i) => i.investor_id === selectedId);

  return (
    <div className="mx-auto flex h-screen max-w-3xl flex-col px-4">
      <header className="flex flex-col gap-3 border-b border-slate-200 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-ink">{APP_NAME}</h1>
            <p className="text-xs text-ink-faint">
              Grounded answers about your private-markets portfolio. Every number is computed in code and cited.
            </p>
          </div>
        </div>
        <InvestorPicker
          investors={investors}
          selectedId={selectedId}
          onChange={handleInvestorChange}
          disabled={loading}
        />
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto py-4">
        {loadError && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            Could not load data: {loadError}
          </div>
        )}

        {messages.length === 0 && !loadError && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-ink-soft">
            <p className="mb-3">
              {selected ? (
                <>
                  You are viewing <strong>{selected.investor_name}</strong>&rsquo;s portfolio (reporting in{" "}
                  {selected.reporting_currency}). Ask anything about holdings, valuations, fees, calls, or distributions.
                </>
              ) : (
                "Loading investors…"
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  disabled={loading || !selectedId}
                  className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-ink-soft hover:border-accent hover:text-accent disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
              <Thinking steps={liveThinking} active />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-slate-200 py-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder={selectedId ? "Ask about your portfolio…" : "Loading…"}
            disabled={loading || !selectedId}
            className="max-h-40 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || !selectedId}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <p className="mt-1 text-[11px] text-ink-faint">
          {APP_NAME} reports facts only and does not give investment advice. Enter to send · Shift+Enter for a new line.
        </p>
      </form>
    </div>
  );
}
