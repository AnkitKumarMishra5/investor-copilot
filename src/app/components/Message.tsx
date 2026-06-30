"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "./types";
import { SourcePanel } from "./SourcePanel";
import { Thinking } from "./Thinking";

export function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const hasThinking = !isUser && (message.thinkingSteps?.length ?? 0) > 0;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm",
          isUser
            ? "bg-accent text-white"
            : message.error
            ? "border border-rose-200 bg-rose-50 text-rose-900"
            : "border border-slate-200 bg-white text-ink",
        ].join(" ")}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {hasThinking && (
              <Thinking
                steps={message.thinkingSteps!}
                durationMs={message.thinkingDurationMs}
                defaultCollapsed
              />
            )}
            <div className="markdown leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || "…"}</ReactMarkdown>
            </div>
          </>
        )}
        {!isUser && !message.error && (
          <SourcePanel sources={message.sources ?? []} trace={message.trace} />
        )}
      </div>
    </div>
  );
}
