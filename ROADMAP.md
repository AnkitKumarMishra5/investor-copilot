# Roadmap — from Q&A prototype to a six-month AI Relationship Manager

This prototype answers an investor's questions about their structured portfolio data. The full product is an **AI relationship manager (RM)** embedded in the investor app: proactive, multi-channel, and trustworthy, handling the routine relationship work that today consumes a human RM's time — while keeping a human firmly in the loop for judgement, advice, and exceptions.

A note on retrieval: **this prototype's structured-data Q&A does not need RAG** — deterministic queries over a small typed dataset are correct and fast. The full product's **unstructured** side (fund memos, quarterly letters, contracts, research, email history) *does* need retrieval. The two coexist: deterministic code owns every number; retrieval grounds every narrative claim about documents.

---

## 1. Scope and capabilities

### What the RM does (beyond Q&A)
- **Proactive nudges & summaries:** "What needs my attention" on login; quarterly portfolio recaps; alerts on down rounds, write-offs, large marks, exits.
- **Capital-call & fee reminders:** ahead-of-due-date notifications, payment-status tracking, overdue follow-ups, and pre-filled wire instructions.
- **Document & KYC requests:** detect missing/expiring KYC, request documents, validate and route them, chase outstanding items.
- **Onboarding:** guided new-investor onboarding (profile, KYC/AML, suitability, banking, e-signature of subscription docs).
- **Reporting:** on-demand and scheduled statements, capital account summaries, tax-pack assembly, custom exports.
- **Drafting investor comms:** draft (never auto-send) personalised updates, answers to LP queries, and follow-ups for human review.
- **Conversational Q&A:** everything the prototype does, deeper, with document grounding.

### What stays human
- Investment **advice / suitability decisions** and any recommendation to buy/sell/hold.
- **Final approval** of outbound communications, capital-call issuance, and any money movement.
- **KYC/AML adjudication** and exception handling; regulatory sign-off.
- Relationship judgement calls, escalations, and complaints.

The RM **drafts, reminds, retrieves, computes, and routes**; humans **decide and approve**.

---

## 2. End-to-end architecture and stack

**Client**
- Web (Next.js) + mobile (React Native) sharing an API; in-app chat, proactive cards, document upload, e-sign flows.

**Backend**
- API gateway + service layer (TypeScript/Node or Python). Async workers (queue: SQS/Cloud Tasks) for reminders, report generation, document processing, and scheduled summaries.
- **Deterministic finance engine** (the descendant of this prototype's `compute/`): the single source of truth for every number, exposed as internal services and as model tools.

**Data layer**
- **Portfolio ledger / warehouse** (Postgres + a columnar warehouse for analytics) as the system of record for positions, cashflows, valuations, fees.
- **Document store** (object storage) + a **vector index** (pgvector / managed vector DB) for unstructured retrieval.
- **Event log / audit store** (append-only) capturing every model action, tool call, source, and human approval.

**Retrieval**
- Hybrid: deterministic SQL/services for numbers; **RAG only for documents** (memos, letters, contracts) with citations to page/section.

**Model choice / hosting**
- A strong hosted tool-calling model for orchestration and drafting (e.g. a current GPT/Claude-class model), with the model behind a config flag for easy swap and cost control. Consider a smaller/cheaper model for routing and a stronger one for drafting.
- Option for VPC/private deployment or a vendor with data-processing guarantees if required by jurisdiction.

**Orchestration**
- Tool-calling loop with typed tools (extending this prototype's `ai/tools.ts`), plus a planner for multi-step workflows (e.g. onboarding) and human-in-the-loop checkpoints.

**Eval & observability**
- Expanded golden evals + property tests over the whole investor base; regression suite gating deploys.
- Tracing of every conversation: tools called, sources, latency, tokens, cost; quality scoring and drift monitoring; PII-aware logging.

**Security**
- Per-request session scoping (already the pattern here), RBAC, tenant isolation, encryption at rest/in transit, secrets management, least-privilege integration credentials, full audit trail.

---

## 3. Data and integrations

| Domain | System (build/buy) | Data flow |
|---|---|---|
| Portfolio ledger | internal warehouse (build) | system of record for positions, cashflows, valuations, fees |
| Fund administration | fund admin platform (buy/integrate) | NAVs, capital accounts, calls/distributions sync in |
| CRM | Salesforce/HubSpot (buy) | investor profile, interactions, tasks out/in |
| KYC/AML | specialist vendor (buy) | identity verification, screening, status back to ledger |
| E-signature | DocuSign/Dropbox Sign (buy) | subscription docs, consents |
| Comms | email/SMS/push provider (buy) | reminders, summaries (human-approved sends) |
| Valuation / market data | data vendors (buy) | marks, comparables for the valuation engine |
| Documents | object storage + vector index (build on managed infra) | memos/letters/contracts for RAG |

Data flows into the ledger/warehouse via scheduled syncs and webhooks; the finance engine reads the ledger; the RM reads the engine (numbers) and the vector index (documents); all writes that touch money, comms, or KYC go through human approval and the audit log.

---

## 4. AI approach and safety

- **Deterministic code owns every number.** The LLM routes and phrases; it never computes. This prototype's contract (`{ value, sources }`) generalises across the product.
- **Grounding/retrieval:** numbers from the finance engine; document claims from RAG with citations; the model must cite or abstain.
- **Tool use:** typed tools with strict schemas; destructive/sensitive actions are gated behind explicit human approval steps.
- **Evaluation:** golden + property-based tests for the finance engine; retrieval-quality and answer-faithfulness evals for documents; red-team suite for prompt injection and data exfiltration.
- **Guardrails:** no investment advice; surface ambiguity; abstain over bluff; session/tenant scoping; refusal of cross-investor access.
- **Audit trail:** every answer, tool call, source, draft, and approval is logged immutably — essential for a regulated context.
- **Data protection:** PII minimisation, encryption, access controls, regional data residency, vendor DPAs, retention policies.

---

## 5. Team and hiring

A lean team for the first six months (~6–8 people):

- **Tech lead / staff engineer (1)** — architecture, finance engine, eval strategy.
- **Full-stack engineers (2)** — app, API, integrations.
- **AI/ML engineer (1)** — orchestration, RAG, evals, model ops.
- **Data engineer (1)** — ledger/warehouse, fund-admin and market-data pipelines.
- **Product designer (1, can be part-time early)** — chat UX, proactive surfaces, trust/verification design.
- **Product manager (1)** — scope, stakeholders, compliance liaison.
- **Compliance / domain advisor (fractional)** — regulatory guardrails, KYC/AML, advice boundary.

Hire the tech lead, AI/ML engineer, and data engineer first (months 0–1); add full-stack and design as workflows expand.

---

## 6. Phased six-month timeline

**Month 1 — Foundations.** Productionise the finance engine and ledger/warehouse; CI with the eval gate; auth/session scoping/RBAC; observability and audit-log skeleton. *Milestone: grounded Q&A on real ledger data, fully traced.*

**Month 2 — Proactive layer.** "What needs my attention," capital-call/fee reminders, scheduled summaries; notification infra (human-approved sends). *Milestone: reminders and proactive cards live for a pilot cohort.*

**Month 3 — Documents & RAG.** Document store + vector index; retrieval with citations for memos/letters; faithfulness evals. *Milestone: cited answers over unstructured docs.*

**Month 4 — Onboarding & KYC.** KYC/AML and e-signature integrations; guided onboarding; document-request/chase workflows with human adjudication. *Milestone: end-to-end onboarding with human approval.*

**Month 5 — Reporting & comms drafting.** On-demand/scheduled statements and tax packs; AI-drafted investor comms for human review; CRM sync. *Milestone: report generation + reviewed drafted comms.*

**Month 6 — Harden & scale.** Red-team and security review; performance and cost optimisation; expanded evals across the full investor base; controlled GA rollout. *Milestone: GA with monitoring, audit, and rollback.*

---

## 7. Risks, build-vs-buy, and cost shape

**Risks & mitigations**
- *Wrong numbers* → deterministic engine + evals; numbers never from the model.
- *Hallucinated document claims* → citation-required RAG, faithfulness evals, abstain-by-default.
- *Prompt injection / data exfiltration* → strict tool scoping, session/tenant isolation, red-teaming, output filtering.
- *Regulatory (advice boundary, KYC, records)* → hard guardrails, human approval gates, immutable audit trail, compliance review.
- *Integration fragility* → idempotent syncs, reconciliation jobs, alerting.

**Build vs buy**
- **Build:** finance engine, orchestration, eval harness, the trust/verification UX — these are the differentiators.
- **Buy/integrate:** KYC/AML, e-signature, CRM, comms delivery, market/valuation data, fund admin, managed vector/DB infra.

**Rough cost shape (first six months)**
- Dominated by **team** cost (6–8 people).
- **LLM tokens:** modest and controllable — the model only routes and phrases; cheap models suffice for routing, and per-conversation cost is low. Budget grows with usage but stays a minor line vs. headcount.
- **Infra & SaaS:** cloud (app, DB, warehouse, vector index, workers) + per-seat/usage fees for KYC, e-sign, CRM, data vendors — meaningful but secondary to team.
- **One-offs:** security review / pen test before GA.
