export type ThinkingPhase = "understanding" | "tool" | "computing" | "writing";

export interface ThinkingStep {
  id: string;
  phase: ThinkingPhase;
  label: string;
  tool?: string;
}

export interface ToolTraceEntry {
  tool: string;
  args: Record<string, unknown>;
  sources: string[];
  result: unknown;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  trace?: ToolTraceEntry[];
  model?: string;
  error?: boolean;
  thinkingSteps?: ThinkingStep[];
  thinkingDurationMs?: number;
}

export interface InvestorSummary {
  investor_id: string;
  investor_name: string;
  reporting_currency: string;
  tech_savviness: string;
  age: number;
  kyc_status: string;
}
