"use client";

import { useState } from "react";
import type { ToolTraceEntry } from "./types";

interface Props {
  sources: string[];
  trace?: ToolTraceEntry[];
}

function classify(id: string): { label: string; cls: string } {
  if (id.startsWith("fx:")) return { label: id, cls: "bg-amber-100 text-amber-800" };
  if (id.startsWith("ALC")) return { label: id, cls: "bg-blue-100 text-blue-800" };
  if (id.startsWith("VAL")) return { label: id, cls: "bg-emerald-100 text-emerald-800" };
  if (id.startsWith("FEE")) return { label: id, cls: "bg-rose-100 text-rose-800" };
  if (id.startsWith("CALL")) return { label: id, cls: "bg-purple-100 text-purple-800" };
  if (id.startsWith("DIST")) return { label: id, cls: "bg-teal-100 text-teal-800" };
  if (id.startsWith("SL")) return { label: id, cls: "bg-slate-200 text-slate-700" };
  return { label: id, cls: "bg-slate-100 text-slate-700" };
}

export function SourcePanel({ sources, trace }: Props) {
  const [open, setOpen] = useState(false);
  if ((!sources || sources.length === 0) && (!trace || trace.length === 0)) return null;

  return (
    <div className="mt-3 border-t border-slate-200 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
      >
        <span>{open ? "▾" : "▸"}</span>
        Show the math · {sources?.length ?? 0} source row{(sources?.length ?? 0) === 1 ? "" : "s"}
      </button>

      {open && (
        <div className="mt-2 space-y-3 text-xs">
          {sources && sources.length > 0 && (
            <div>
              <div className="mb-1 font-semibold text-ink-soft">Source rows used</div>
              <div className="flex flex-wrap gap-1">
                {sources.map((s) => {
                  const c = classify(s);
                  return (
                    <span key={s} className={`rounded px-1.5 py-0.5 font-mono ${c.cls}`}>
                      {c.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {trace && trace.length > 0 && (
            <div>
              <div className="mb-1 font-semibold text-ink-soft">Calculation trace</div>
              <div className="space-y-2">
                {trace.map((t, idx) => (
                  <details key={idx} className="rounded border border-slate-200 bg-slate-50 p-2">
                    <summary className="cursor-pointer font-mono text-[11px] text-ink-soft">
                      {t.tool}({Object.keys(t.args).length ? JSON.stringify(t.args) : ""})
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 text-[11px] leading-snug text-ink-soft">
                      {JSON.stringify(t.result, null, 2)}
                    </pre>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
