import type { DataStore, Investor, PortfolioCompany } from "../data/types";
import {
  companyPositionsForInvestor,
  getAccountStatement,
  getDistributions,
  getFees,
  getPortfolioOverview,
  getUpcomingObligations,
  lineFromPosition,
  matchInvestorCompanies,
  positionsForInvestor,
  round2,
  round4,
  valuationHistory,
} from "../compute";

export const TOOL_SCHEMAS = [
  {
    type: "function" as const,
    function: {
      name: "get_portfolio_overview",
      description:
        "Overview of the investor's whole portfolio: total current value, committed vs contributed vs outstanding, net distributions, and MOIC/DPI/RVPI, all in their reporting currency. Use for broad 'how is my portfolio doing' questions.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_holdings",
      description:
        "List the companies and deals (rounds) the investor holds. Use this to disambiguate company names or when the user asks what they own.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_position",
      description:
        "Detailed position for a single company across all of the investor's rounds in it: cost basis, share price paid per round, latest mark, current value, realised distributions, and MOIC. If the name is ambiguous, all matches are returned for disambiguation.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Company name or fragment, e.g. 'Forgecraft'." },
        },
        required: ["company_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_commitment_vs_contributed",
      description:
        "Commitment vs contributed vs outstanding capital. Use for 'how much have I invested / committed' questions. Optionally scope to a company name.",
      parameters: {
        type: "object",
        properties: {
          scope: { type: "string", description: "Optional company name to scope to." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_fees",
      description:
        "Fee schedule for a company/deal: the investor's effective management/performance/structuring/admin fees compared to the deal standard, plus charged fee line items and their status. Admin fees are in USD.",
      parameters: {
        type: "object",
        properties: {
          company_or_deal: { type: "string", description: "Company name or fragment. Omit for all fees." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_upcoming_obligations",
      description:
        "Upcoming capital calls and upcoming/overdue fees the investor owes, in their reporting currency. Use for 'what do I owe / what's due' questions.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_distributions",
      description:
        "Distributions received (exit proceeds and secondary sales), gross and net of carry. Optionally scope to a company.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Optional company name to scope to." },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_valuation_history",
      description:
        "Valuation marks over time for a company's deals and the multiple vs entry, to explain how the value (and MOIC) moved, including down rounds.",
      parameters: {
        type: "object",
        properties: {
          company_name: { type: "string", description: "Company name or fragment." },
        },
        required: ["company_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_account_statement",
      description:
        "Plain-language account statement: cash flows in and out (capital calls paid, fees, distributions), netted, in the reporting currency. Optional filter matches the line type.",
      parameters: {
        type: "object",
        properties: {
          filter: { type: "string", description: "Optional substring to filter line types." },
        },
        additionalProperties: false,
      },
    },
  },
];

interface ResolveResult {
  status: "none" | "one" | "ambiguous";
  companies: PortfolioCompany[];
}

function resolveCompanies(
  store: DataStore,
  investor: Investor,
  name: string
): ResolveResult {
  const matches = matchInvestorCompanies(store, investor.investor_id, name);
  if (matches.length === 0) return { status: "none", companies: [] };
  if (matches.length === 1) return { status: "one", companies: matches };
  return { status: "ambiguous", companies: matches };
}

export interface ToolResult {
  result: unknown;
  sources: string[];
}

function buildCompanyReport(
  store: DataStore,
  investor: Investor,
  company: PortfolioCompany
) {
  const cp = companyPositionsForInvestor(store, investor.investor_id, company.company_id);
  if (!cp) return null;
  const reporting = investor.reporting_currency;
  const rounds = cp.positions.map((p) => {
    const line = lineFromPosition(store, p, reporting);
    return {
      deal_id: p.deal.deal_id,
      round: p.deal.round,
      allocation_id: p.allocation.allocation_id,
      deal_currency: p.dealCurrency,
      entry_share_price: round4(p.deal.entry_share_price),
      effective_share_price_paid: round4(p.allocation.effective_share_price),
      price_discount_pct: p.allocation.price_discount_pct,
      units: round4(p.allocation.units),
      latest_mark: p.latestMarkPrice != null ? round4(p.latestMarkPrice) : null,
      multiple_vs_entry: p.multipleVsEntry != null ? round4(p.multipleVsEntry) : null,
      status: line.status,
      is_pending: p.isPending,
      realised_fraction: round4(p.realisedFraction),
      commitment_reporting: round2(line.commitment),
      contributed_reporting: round2(line.contributed),
      outstanding_reporting: round2(line.outstanding),
      current_value_reporting: round2(line.currentValue),
      net_distributions_reporting: round2(line.netDistributions),
      moic: line.moic != null ? round4(line.moic) : null,
      sources: line.sources,
    };
  });

  let contributed = 0;
  let currentValue = 0;
  let netDist = 0;
  let commitment = 0;
  let outstanding = 0;
  const sources = new Set<string>();
  for (const r of rounds) {
    contributed += r.contributed_reporting;
    currentValue += r.current_value_reporting;
    netDist += r.net_distributions_reporting;
    commitment += r.commitment_reporting;
    outstanding += r.outstanding_reporting;
    r.sources.forEach((s) => sources.add(s));
  }
  const moic = contributed > 0 ? (currentValue + netDist) / contributed : null;

  return {
    company_name: company.company_name,
    sector: company.sector,
    company_status: company.status,
    reporting_currency: reporting,
    rounds,
    aggregate: {
      commitment_reporting: round2(commitment),
      contributed_reporting: round2(contributed),
      outstanding_reporting: round2(outstanding),
      current_value_reporting: round2(currentValue),
      net_distributions_reporting: round2(netDist),
      moic: moic != null ? round4(moic) : null,
    },
    sources: [...sources],
  };
}

export function runTool(
  store: DataStore,
  investor: Investor,
  name: string,
  args: Record<string, unknown>
): ToolResult {
  const reporting = investor.reporting_currency;

  switch (name) {
    case "get_portfolio_overview": {
      const o = getPortfolioOverview(store, investor);
      if (!o.hasHoldings) {
        return {
          result: { has_holdings: false, message: "This investor has no allocations." },
          sources: [],
        };
      }
      return {
        result: {
          has_holdings: true,
          reporting_currency: reporting,
          total_current_value: round2(o.totalCurrentValue),
          total_committed: round2(o.totalCommitment),
          total_contributed: round2(o.totalContributed),
          total_outstanding: round2(o.totalOutstanding),
          total_net_distributions: round2(o.totalNetDistributions),
          moic: o.moic != null ? round4(o.moic) : null,
          dpi: o.dpi != null ? round4(o.dpi) : null,
          rvpi: o.rvpi != null ? round4(o.rvpi) : null,
          deal_count: o.dealCount,
          company_count: o.companyCount,
          pending_count: o.pendingCount,
          holdings: o.lines.map((l) => ({
            company_name: l.companyName,
            round: l.round,
            allocation_id: l.allocationId,
            current_value_reporting: round2(l.currentValue),
            contributed_reporting: round2(l.contributed),
            net_distributions_reporting: round2(l.netDistributions),
            moic: l.moic != null ? round4(l.moic) : null,
            status: l.status,
            is_pending: l.isPending,
          })),
        },
        sources: o.sources,
      };
    }

    case "list_holdings": {
      const positions = positionsForInvestor(store, investor.investor_id);
      if (positions.length === 0) {
        return { result: { has_holdings: false, holdings: [] }, sources: [] };
      }
      const byCompany = new Map<string, { company_name: string; sector: string; status: string; rounds: string[] }>();
      const sources = new Set<string>();
      for (const p of positions) {
        const key = p.deal.company_id;
        const entry = byCompany.get(key) ?? {
          company_name: p.deal.company_name,
          sector: p.company?.sector ?? "",
          status: p.company?.status ?? p.deal.status,
          rounds: [],
        };
        entry.rounds.push(`${p.deal.round} (${p.deal.deal_id})`);
        byCompany.set(key, entry);
        sources.add(p.allocation.allocation_id);
      }
      return {
        result: { has_holdings: true, holdings: [...byCompany.values()] },
        sources: [...sources],
      };
    }

    case "get_position": {
      const query = String(args.company_name ?? "");
      const r = resolveCompanies(store, investor, query);
      if (r.status === "none") {
        return {
          result: {
            found: false,
            message: `No holding matching "${query}" for this investor.`,
            hint: "Call list_holdings to see what the investor owns.",
          },
          sources: [],
        };
      }
      if (r.status === "ambiguous") {
        return {
          result: {
            found: true,
            ambiguous: true,
            message: `"${query}" matches more than one holding; ask the user which, or report both.`,
            matches: r.companies.map((c) => ({ company_name: c.company_name, sector: c.sector })),
            positions: r.companies.map((c) => buildCompanyReport(store, investor, c)),
          },
          sources: [],
        };
      }
      const report = buildCompanyReport(store, investor, r.companies[0]);
      return { result: { found: true, ambiguous: false, ...report }, sources: report?.sources ?? [] };
    }

    case "get_commitment_vs_contributed": {
      const scope = args.scope ? String(args.scope) : undefined;
      if (scope) {
        const r = resolveCompanies(store, investor, scope);
        if (r.status === "none") {
          return { result: { found: false, message: `No holding matching "${scope}".` }, sources: [] };
        }
        const reports = r.companies.map((c) => buildCompanyReport(store, investor, c));
        return {
          result: {
            found: true,
            ambiguous: r.status === "ambiguous",
            note: "Commitment is the total promised; contributed is the capital actually called/paid in; outstanding is the difference (uncalled).",
            scope: scope,
            companies: reports?.map((rep) => ({
              company_name: rep?.company_name,
              commitment_reporting: rep?.aggregate.commitment_reporting,
              contributed_reporting: rep?.aggregate.contributed_reporting,
              outstanding_reporting: rep?.aggregate.outstanding_reporting,
            })),
          },
          sources: reports.flatMap((rep) => rep?.sources ?? []),
        };
      }
      const o = getPortfolioOverview(store, investor);
      return {
        result: {
          found: o.hasHoldings,
          reporting_currency: reporting,
          note: "Commitment is the total promised; contributed is what has actually been called/paid; outstanding is uncalled.",
          total_commitment: round2(o.totalCommitment),
          total_contributed: round2(o.totalContributed),
          total_outstanding: round2(o.totalOutstanding),
          pending_count: o.pendingCount,
        },
        sources: o.sources,
      };
    }

    case "get_fees": {
      const scope = args.company_or_deal ? String(args.company_or_deal) : undefined;
      let companyIds: string[] | undefined;
      let ambiguous = false;
      if (scope) {
        const r = resolveCompanies(store, investor, scope);
        if (r.status === "none") {
          return { result: { found: false, message: `No holding matching "${scope}".` }, sources: [] };
        }
        ambiguous = r.status === "ambiguous";
        companyIds = r.companies.map((c) => c.company_id);
      }
      const report = getFees(store, investor, companyIds);
      return {
        result: {
          found: true,
          ambiguous,
          reporting_currency: reporting,
          note: "Effective rates are what this investor actually pays; std_* are the deal standard. Admin fees are in USD even on non-USD deals. A waived fee produces no line.",
          schedules: report.schedules,
          charged_fees: report.charged.map((c) => ({
            fee_id: c.feeId,
            type: c.feeType,
            period: c.period,
            basis: c.basis,
            rate_pct: c.rate,
            amount: round2(c.amount),
            currency: c.currency,
            amount_reporting: round2(c.amountReporting),
            status: c.status,
            due_date: c.dueDate,
            company_name: c.companyName,
          })),
        },
        sources: report.sources,
      };
    }

    case "get_upcoming_obligations": {
      const o = getUpcomingObligations(store, investor);
      return {
        result: {
          reporting_currency: reporting,
          total_upcoming_reporting: round2(o.totalUpcomingReporting),
          total_overdue_reporting: round2(o.totalOverdueReporting),
          items: o.items.map((it) => ({
            kind: it.kind,
            ref_id: it.refId,
            company_name: it.companyName,
            amount: round2(it.amount),
            currency: it.currency,
            amount_reporting: round2(it.amountReporting),
            due_date: it.dueDate,
            status: it.status,
          })),
        },
        sources: o.sources,
      };
    }

    case "get_distributions": {
      const scope = args.company_name ? String(args.company_name) : undefined;
      let companyIds: string[] | undefined;
      if (scope) {
        const r = resolveCompanies(store, investor, scope);
        if (r.status === "none") {
          return { result: { found: false, message: `No holding matching "${scope}".` }, sources: [] };
        }
        companyIds = r.companies.map((c) => c.company_id);
      }
      const report = getDistributions(store, investor, companyIds);
      return {
        result: {
          reporting_currency: reporting,
          note: "net_amount is already net of carry (performance fee). Exit Proceeds = full/partial exit; Secondary Sale = selling part of the position.",
          total_gross_reporting: round2(report.totalGrossReporting),
          total_carry_reporting: round2(report.totalCarryReporting),
          total_net_reporting: round2(report.totalNetReporting),
          items: report.items.map((d) => ({
            distribution_id: d.distributionId,
            company_name: d.companyName,
            date: d.date,
            type: d.type,
            gross_amount: round2(d.grossAmount),
            performance_fee_pct: d.performanceFeePct,
            performance_fee_amount: round2(d.performanceFeeAmount),
            net_amount: round2(d.netAmount),
            currency: d.currency,
            net_amount_reporting: round2(d.netAmountReporting),
            fraction_of_units: round4(d.fractionOfUnits),
          })),
        },
        sources: report.sources,
      };
    }

    case "get_valuation_history": {
      const query = String(args.company_name ?? "");
      const r = resolveCompanies(store, investor, query);
      if (r.status === "none") {
        return { result: { found: false, message: `No holding matching "${query}".` }, sources: [] };
      }
      const sources = new Set<string>();
      const companies = r.companies.map((c) => {
        const cp = companyPositionsForInvestor(store, investor.investor_id, c.company_id);
        const deals = (cp?.positions ?? []).map((p) => {
          const hist = valuationHistory(store, p.deal.deal_id);
          hist.forEach((h) => sources.add(h.valuation_id));
          return {
            deal_id: p.deal.deal_id,
            round: p.deal.round,
            entry_share_price: round4(p.deal.entry_share_price),
            marks: hist.map((h) => ({
              date: h.valuation_date,
              share_price: round4(h.share_price),
              multiple_vs_entry: round4(h.multiple_vs_entry),
              source: h.mark_source,
            })),
            latest_multiple_vs_entry: p.multipleVsEntry != null ? round4(p.multipleVsEntry) : null,
            is_down_round_vs_entry: p.latestMarkPrice != null && p.latestMarkPrice < p.deal.entry_share_price,
          };
        });
        return { company_name: c.company_name, company_status: c.status, deals };
      });
      return {
        result: { found: true, ambiguous: r.status === "ambiguous", companies },
        sources: [...sources],
      };
    }

    case "get_account_statement": {
      const filter = args.filter ? String(args.filter) : undefined;
      const s = getAccountStatement(store, investor, filter);
      return {
        result: {
          reporting_currency: reporting,
          total_in_reporting: round2(s.totalInflowReporting),
          total_out_reporting: round2(s.totalOutflowReporting),
          net_reporting: round2(s.netReporting),
          net_by_type: Object.fromEntries(
            Object.entries(s.byType).map(([k, v]) => [k, round2(v)])
          ),
          line_count: s.entries.length,
          recent_lines: s.entries.slice(-25).map((e) => ({
            line_id: e.lineId,
            date: e.date,
            type: e.type,
            company_name: e.companyName,
            amount: round2(e.amount),
            currency: e.currency,
            amount_reporting: round2(e.amountReporting),
          })),
        },
        sources: s.sources,
      };
    }

    default:
      return { result: { error: `Unknown tool: ${name}` }, sources: [] };
  }
}
