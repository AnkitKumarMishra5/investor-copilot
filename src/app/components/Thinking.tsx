"use client";

import { useState } from "react";
import {
  Calculator,
  CheckCircle2,
  FunctionSquare,
  PenLine,
  Sparkles,
} from "lucide-react";
import type { ThinkingPhase, ThinkingStep } from "./types";

interface Props {
  steps: ThinkingStep[];
  active?: boolean;
  durationMs?: number;
  defaultCollapsed?: boolean;
}

function StepIcon({ phase }: { phase: ThinkingPhase }) {
  const cls = "h-4 w-4 shrink-0 text-slate-400";
  switch (phase) {
    case "understanding":
      return <Sparkles className={cls} strokeWidth={2} />;
    case "tool":
      return <FunctionSquare className={cls} strokeWidth={2} />;
    case "computing":
      return <Calculator className={cls} strokeWidth={2} />;
    case "writing":
      return <PenLine className={cls} strokeWidth={2} />;
  }
}

function phaseLabel(step: ThinkingStep): string {
  if (step.label) return step.label;
  switch (step.phase) {
    case "understanding":
      return "Understanding your question";
    case "computing":
      return "Computing from portfolio data";
    case "writing":
      return "Writing your answer";
    default:
      return "Working…";
  }
}

function TypingDots() {
  return (
    <span className="typing-dots inline-flex items-center gap-0.5 pl-0.5" aria-hidden="true">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  );
}

export function Thinking({ steps, active = false, durationMs, defaultCollapsed = false }: Props) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const completedCount = active ? Math.max(0, steps.length - 1) : steps.length;
  const durationSec = durationMs != null ? Math.max(1, Math.round(durationMs / 1000)) : null;

  if (steps.length === 0 && !active) return null;

  const summary =
    durationSec != null
      ? `Thought for ${durationSec}s · ${completedCount} step${completedCount === 1 ? "" : "s"}`
      : active
      ? "Thinking…"
      : `${completedCount} step${completedCount === 1 ? "" : "s"}`;

  if (!active && defaultCollapsed && !expanded) {
    return (
      <div className="mb-2 border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-slate-500 hover:text-slate-700"
        >
          ▸ {summary}
        </button>
      </div>
    );
  }

  const activeLabel =
    steps.length > 0 ? phaseLabel(steps[steps.length - 1]) : "Understanding your question";

  if (active) {
    return (
      <div className="space-y-2 text-sm">
        {steps.length > 1 && (
          <ul className="space-y-1">
            {steps.slice(0, -1).map((step) => (
              <li key={step.id} className="thinking-step-done flex items-center gap-2 text-xs text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600/80" strokeWidth={2} />
                <span>{phaseLabel(step)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2 text-slate-600">
          <StepIcon phase={steps.length > 0 ? steps[steps.length - 1].phase : "understanding"} />
          <span className="thinking-shimmer-ltr font-medium">{activeLabel}</span>
          <TypingDots />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 border-t border-slate-100 pt-2">
      {defaultCollapsed && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mb-2 text-xs text-slate-500 hover:text-slate-700"
        >
          ▾ {summary}
        </button>
      )}

      {(expanded || !defaultCollapsed) && (
        <ul className="space-y-1">
          {steps.map((step) => (
            <li key={step.id} className="thinking-step-done flex items-center gap-2 text-xs text-slate-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600/80" strokeWidth={2} />
              <span>{phaseLabel(step)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
