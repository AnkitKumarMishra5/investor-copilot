import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import { OPENAI_MODEL } from "../config";
import { getStore } from "../data/loader";
import { getProfile } from "../compute/profile";
import { buildSystemPrompt } from "./systemPrompt";
import { runTool, TOOL_SCHEMAS } from "./tools";
import { toolLabel } from "./toolLabels";
import type { StreamEmitter } from "./streamTypes";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ToolTraceEntry {
  tool: string;
  args: Record<string, unknown>;
  sources: string[];
  result: unknown;
}

export interface OrchestratorResult {
  content: string;
  sources: string[];
  trace: ToolTraceEntry[];
  model: string;
}

const MAX_TOOL_ROUNDS = 6;

function prepareSession(investorId: string) {
  const store = getStore();
  const investor = store.investorById.get(investorId);
  if (!investor) {
    throw new Error(`Unknown investor: ${investorId}`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set. Copy .env.example to .env.local and add your key."
    );
  }

  const client = new OpenAI({ apiKey });
  const profile = getProfile(store, investor);
  const systemPrompt = buildSystemPrompt(profile);

  return { store, investor, client, systemPrompt };
}

export async function runChatStream(
  investorId: string,
  history: ChatTurn[],
  emit: StreamEmitter
): Promise<OrchestratorResult> {
  const { store, investor, client, systemPrompt } = prepareSession(investorId);

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
  ];

  const allSources = new Set<string>();
  const trace: ToolTraceEntry[] = [];

  emit({ type: "status", phase: "understanding" });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
      tools: TOOL_SCHEMAS,
      tool_choice: "auto",
      temperature: 0.2,
    });

    const msg = completion.choices[0].message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      messages.push(msg as ChatCompletionMessageParam);

      for (const call of msg.tool_calls) {
        if (call.type !== "function") continue;
        let args: Record<string, unknown> = {};
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = {};
        }
        delete (args as Record<string, unknown>).investor_id;
        delete (args as Record<string, unknown>).investorId;

        const name = call.function.name;
        const label = toolLabel(name, args);
        emit({ type: "status", phase: "tool", tool: name, label });
        emit({ type: "status", phase: "computing", tool: name });

        const { result, sources } = runTool(store, investor, name, args);
        sources.forEach((s) => allSources.add(s));
        trace.push({ tool: name, args, sources, result });

        const toolMsg: ChatCompletionToolMessageParam = {
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        };
        messages.push(toolMsg);
      }
      continue;
    }

    emit({ type: "status", phase: "writing" });
    const content = msg.content ?? "";
    const result: OrchestratorResult = {
      content,
      sources: [...allSources],
      trace,
      model: OPENAI_MODEL,
    };
    emit({
      type: "final",
      reply: content,
      sources: result.sources,
      trace,
      model: OPENAI_MODEL,
    });
    return result;
  }

  emit({ type: "status", phase: "writing" });
  const finalCompletion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      ...messages,
      {
        role: "system",
        content:
          "Provide your best final answer now using only the tool results already gathered. Do not request more tools.",
      },
    ],
    temperature: 0.2,
  });

  const content = finalCompletion.choices[0].message.content ?? "";
  const result: OrchestratorResult = {
    content,
    sources: [...allSources],
    trace,
    model: OPENAI_MODEL,
  };
  emit({
    type: "final",
    reply: content,
    sources: result.sources,
    trace,
    model: OPENAI_MODEL,
  });
  return result;
}
