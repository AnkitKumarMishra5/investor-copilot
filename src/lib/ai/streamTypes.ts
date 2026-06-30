import type { ToolTraceEntry } from "./orchestrator";

export type StatusPhase = "understanding" | "tool" | "computing" | "writing";

export type StreamEvent =
  | { type: "status"; phase: "understanding" }
  | { type: "status"; phase: "tool"; tool: string; label: string }
  | { type: "status"; phase: "computing"; tool: string }
  | { type: "status"; phase: "writing" }
  | {
      type: "final";
      reply: string;
      sources: string[];
      trace: ToolTraceEntry[];
      model: string;
    }
  | { type: "error"; message: string };

export type StreamEmitter = (event: StreamEvent) => void;
