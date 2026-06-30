import type { Currency, DataStore, Investor } from "../data/types";
import { convert, fxNote } from "./fx";
import {
  AllocationPosition,
  positionsForInvestor,
} from "./positions";

export interface PortfolioLine {
  allocationId: string;
  dealId: string;
  companyId: string;
  companyName: string;
  round: string;
  dealCurrency: Currency;
  reportingCurrency: Currency;

  commitment: number;
  contributed: number;
  outstanding: number;
  currentValue: number;
  netDistributions: number;
  moic: number | null;

  status: string;
  isPending: boolean;
  isWrittenOff: boolean;
  isExited: boolean;

  sources: string[];
}

export interface PortfolioOverview {
  investorId: string;
  reportingCurrency: Currency;
  hasHoldings: boolean;

  totalCommitment: number;
  totalContributed: number;
  totalOutstanding: number;
  totalCurrentValue: number;
  totalNetDistributions: number;

  moic: number | null;
  dpi: number | null;
  rvpi: number | null;

  dealCount: number;
  companyCount: number;
  pendingCount: number;

  lines: PortfolioLine[];
  sources: string[];
}

function toReporting(
  store: DataStore,
  amount: number,
  from: Currency,
  to: Currency,
  sources: string[]
): number {
  const note = fxNote(from, to);
  if (note && !sources.includes(note)) sources.push(note);
  return convert(store, amount, from, to);
}

export function lineFromPosition(
  store: DataStore,
  p: AllocationPosition,
  reporting: Currency
): PortfolioLine {
  const sources = [...p.sources];
  const commitment = toReporting(store, p.commitment, p.dealCurrency, reporting, sources);
  const contributed = toReporting(store, p.contributed, p.dealCurrency, reporting, sources);
  const outstanding = toReporting(store, p.outstanding, p.dealCurrency, reporting, sources);
  const currentValue = toReporting(store, p.currentValue, p.dealCurrency, reporting, sources);
  const netDistributions = toReporting(store, p.netDistributions, p.dealCurrency, reporting, sources);
  const moic = contributed > 0 ? (currentValue + netDistributions) / contributed : null;

  return {
    allocationId: p.allocation.allocation_id,
    dealId: p.deal.deal_id,
    companyId: p.deal.company_id,
    companyName: p.deal.company_name,
    round: p.deal.round,
    dealCurrency: p.dealCurrency,
    reportingCurrency: reporting,
    commitment,
    contributed,
    outstanding,
    currentValue,
    netDistributions,
    moic,
    status: p.isWrittenOff ? "Written Off" : p.isExited ? "Exited" : "Active",
    isPending: p.isPending,
    isWrittenOff: p.isWrittenOff,
    isExited: p.isExited,
    sources,
  };
}

export function getPortfolioOverview(
  store: DataStore,
  investor: Investor
): PortfolioOverview {
  const reporting = investor.reporting_currency;
  const positions = positionsForInvestor(store, investor.investor_id);

  const lines = positions.map((p) => lineFromPosition(store, p, reporting));

  let totalCommitment = 0;
  let totalContributed = 0;
  let totalOutstanding = 0;
  let totalCurrentValue = 0;
  let totalNetDistributions = 0;
  const allSources = new Set<string>();
  const companies = new Set<string>();
  let pendingCount = 0;

  for (const line of lines) {
    totalCommitment += line.commitment;
    totalContributed += line.contributed;
    totalOutstanding += line.outstanding;
    totalCurrentValue += line.currentValue;
    totalNetDistributions += line.netDistributions;
    companies.add(line.companyId);
    if (line.isPending) pendingCount += 1;
    for (const s of line.sources) allSources.add(s);
  }

  const moic =
    totalContributed > 0
      ? (totalCurrentValue + totalNetDistributions) / totalContributed
      : null;
  const dpi = totalContributed > 0 ? totalNetDistributions / totalContributed : null;
  const rvpi = totalContributed > 0 ? totalCurrentValue / totalContributed : null;

  return {
    investorId: investor.investor_id,
    reportingCurrency: reporting,
    hasHoldings: lines.length > 0,
    totalCommitment,
    totalContributed,
    totalOutstanding,
    totalCurrentValue,
    totalNetDistributions,
    moic,
    dpi,
    rvpi,
    dealCount: lines.length,
    companyCount: companies.size,
    pendingCount,
    lines,
    sources: [...allSources],
  };
}
