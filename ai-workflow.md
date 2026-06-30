# AI workflow

How this project was built with AI assistance, what was accepted vs. changed, and especially how the answers were verified to be correct.

## Tools and models

- **Coding assistant (agentic IDE):** used to scaffold the Next.js app, write the deterministic compute modules, the tool/orchestrator layer, the UI components, and the eval harness; and to draft the documentation.
- **Runtime model:** OpenAI Chat Completions with tool calling, model configurable via `OPENAI_MODEL` (default `gpt-4o-mini`). The runtime model is used **only** for (a) routing a question to the right deterministic function(s) and (b) phrasing the structured results. It never performs arithmetic.

## Rough split of AI-generated code

- **~80–90% AI-generated first drafts** across the compute core, tools, orchestrator, UI, and docs.
- **Human-directed design and correction** on the parts that matter most: the grounding contract (every result carries its source rows), the FX-before-summing rule, the pending/exit/write-off value rules, session scoping, and the golden numbers in the eval.

The percentage is less interesting than *which* code was trusted blindly (boilerplate, UI, glue) versus *which* was treated as untrusted until proven (every financial formula → covered by the eval).

## What was accepted from AI suggestions

- Project scaffolding and config (Next.js, Tailwind, TypeScript).
- The shape of the typed in-memory store and the index maps.
- The React chat UI, investor picker, "show the math" panel, and live thinking trace (NDJSON status stream).
- The structure of the OpenAI tool schemas and the tool-calling loop.

## What was changed or rejected, and why

- **No vector DB / RAG.** A common default suggestion for "chat over my data" is embeddings + retrieval. Rejected: the data is small and fully structured, so deterministic queries are *more* correct and faster. RAG is reserved for the unstructured side of the full product (see `ROADMAP.md`).
- **Moved all math out of the model.** Early framing would let the model compute totals. Changed so the model is forbidden from doing arithmetic and can only call typed functions. That was the single most important reliability decision.
- **Source IDs on every result.** Made `{ value, sources }` the universal return contract rather than returning bare numbers, so citations are structural, not an afterthought the model has to remember.
- **Pending allocations contribute zero value.** The naive `units * mark` would overstate value for uncalled commitments; corrected to treat Pending as committed-but-uncalled (value 0), matching the domain edge case and the eval assertion.
- **FX conversion before aggregation.** Ensured every line is converted to the reporting currency *before* summing, not after, so multi-currency totals are correct.
- **Session scoping over model trust.** The orchestrator strips any `investor_id` the model might pass and always uses the server-fixed session investor, so cross-investor leakage isn't possible even if the model is prompted to try.

## How correctness was verified

This is the heart of the answer, and it's deliberately not "I read the responses and they looked right."

1. **A deterministic core that can be tested in isolation.** Because no number depends on the LLM, correctness is a property of pure TypeScript functions.
2. **A golden eval (`npm run eval`)** whose expected values were derived **independently** from documented formulas and the worked example, not by reading the app's own output. It checks:
   - exact row counts for all ten tables;
   - FX rates and cross-rates (GBP/EUR/AED via USD);
   - the **INV001 worked example**: Forgecraft Seed effective price 2.25, units ≈ 17,777.78, current value ≈ 273,777.81 USD ≈ 202,798 GBP; portfolio current value ≈ 438,495 GBP, contributed ≈ 168,593 GBP, MOIC ≈ 2.601×, DPI 0, RVPI ≈ 2.601;
   - every structural edge case: Forgecraft → exactly 3 deals; INV022/INV023 zero holdings; ALC0542 pending/excluded; Qubrium DEAL010 down round; Yappio DEAL008 written off → value 0; Helianthe DEAL007 exited → value 0 but distributions counted; Tallybook DEAL020 partial secondary; admin fees in USD on non-USD deals; INV022 session isolation.
3. **Citations as a live audit trail.** In the UI, "Show the math" lists the exact rows behind each figure plus the raw tool results, so any answer can be spot-checked against the data by a human.
4. **Guardrail behaviours** (no advice, ambiguity surfaced, abstain over bluff, no cross-investor data) are enforced in code and prompt and demonstrated by the isolation test.

If the eval is green, the numbers the user sees match what the data model defines. The model only chose which to fetch and how to word them.

## What I'd point an autonomous agent at for the next 8 hours

- **Expand the eval to a broader sample of investors**, not just the documented entities. Randomised property tests (e.g. MOIC = DPI + RVPI; portfolio totals equal the sum of per-line conversions) across all 112 investors.
- **Token streaming** for the final answer text (orchestrator status is already streamed as NDJSON; the reply itself still arrives as one block).
- **A "What needs my attention" proactive panel** on load (upcoming/overdue calls and fees, down-round and written-off positions).
- **Snapshot tests for tool outputs** so any change to the compute layer is caught in review.
- **Lightweight observability**: log each tool call, its sources, latency, and token usage.
- **Accessibility and mobile polish** pass on the UI.
