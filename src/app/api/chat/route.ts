import { NextRequest } from "next/server";
import { runChatStream, type ChatTurn } from "@/lib/ai/orchestrator";
import type { StreamEvent } from "@/lib/ai/streamTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  investorId?: string;
  messages?: ChatTurn[];
}

function ndjsonLine(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { investorId, messages } = body;
  if (!investorId || typeof investorId !== "string") {
    return new Response(JSON.stringify({ error: "investorId is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages must be a non-empty array." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const history: ChatTurn[] = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content }));

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(ndjsonLine(event));
      };
      try {
        await runChatStream(investorId, history, emit);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unexpected error.";
        emit({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
