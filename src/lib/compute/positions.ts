import type {
  Allocation,
  Currency,
  DataStore,
  Deal,
  PortfolioCompany,
} from "../data/types";
import { latestMark } from "./valuations";

export interface AllocationPosition {
  allocation: Allocation;
  deal: Deal;
  company?: PortfolioCompany;
  dealCurrency: Currency;

  latestMarkPrice: number | null;
  multipleVsEntry: number | null;
  realisedFraction: number;

  commitment: number;
  contributed: number;
  outstanding: number;
  currentValue: number;
  netDistributions: number;

  moic: number | null;
  dpi: number | null;
  rvpi: number | null;

  isWrittenOff: boolean;
  isExited: boolean;
  isPending: boolean;

  sources: string[];
}

function statusFor(store: DataStore, deal: Deal): string {
  const company = store.companyById.get(deal.company_id);
  return company?.status ?? deal.status;
}

export function computePosition(
  store: DataStore,
  allocation: Allocation
): AllocationPosition {
  const deal = store.dealById.get(allocation.deal_id);
  if (!deal) {
    throw new Error(`Allocation ${allocation.allocation_id} references unknown deal ${allocation.deal_id}`);
  }
  const company = store.companyById.get(deal.company_id);
  const status = statusFor(store, deal);
  const isWrittenOff = status === "Written Off";
  const isExited = status === "Exited";
  const isPending = allocation.allocation_status === "Pending";

  const sources: string[] = [allocation.allocation_id];

  const dists = store.distributionsByAllocation.get(allocation.allocation_id) ?? [];
  let realisedFraction = 0;
  let netDistributions = 0;
  for (const d of dists) {
    realisedFraction += d.fraction_of_units;
    netDistributions += d.net_amount;
    sources.push(d.distribution_id);
  }
  if (realisedFraction < 0) realisedFraction = 0;

  const mark = latestMark(store, allocation.deal_id);
  const latestMarkPrice = mark?.value ?? null;
  if (mark) sources.push(...mark.sources);

  let currentValue = 0;
  if (isWrittenOff) {
    currentValue = 0;
  } else if (isPending) {
    currentValue = 0;
  } else if (isExited && realisedFraction >= 1) {
    currentValue = 0;
  } else if (latestMarkPrice != null) {
    const liveFraction = Math.max(0, 1 - realisedFraction);
    currentValue = allocation.units * latestMarkPrice * liveFraction;
  }

  const commitment = allocation.commitment_amount;
  const contributed = allocation.contributed_amount;
  const outstanding = allocation.outstanding_commitment;

  const moic =
    contributed > 0 ? (currentValue + netDistributions) / contributed : null;
  const dpi = contributed > 0 ? netDistributions / contributed : null;
  const rvpi = contributed > 0 ? currentValue / contributed : null;

  const multipleVsEntry =
    latestMarkPrice != null && deal.entry_share_price > 0
      ? latestMarkPrice / deal.entry_share_price
      : null;

  return {
    allocation,
    deal,
    company,
    dealCurrency: allocation.deal_currency,
    latestMarkPrice,
    multipleVsEntry,
    realisedFraction,
    commitment,
    contributed,
    outstanding,
    currentValue,
    netDistributions,
    moic,
    dpi,
    rvpi,
    isWrittenOff,
    isExited,
    isPending,
    sources,
  };
}

export function positionsForInvestor(
  store: DataStore,
  investorId: string
): AllocationPosition[] {
  const allocs = store.allocationsByInvestor.get(investorId) ?? [];
  return allocs.map((a) => computePosition(store, a));
}

export function matchInvestorCompanies(
  store: DataStore,
  investorId: string,
  query: string
): PortfolioCompany[] {
  const q = query.trim().toLowerCase();
  const positions = positionsForInvestor(store, investorId);
  const byCompany = new Map<string, PortfolioCompany>();
  for (const p of positions) {
    if (!p.company) continue;
    const name = p.company.company_name.toLowerCase();
    if (q.length === 0 || name.includes(q) || q.includes(name)) {
      byCompany.set(p.company.company_id, p.company);
    }
  }
  return [...byCompany.values()];
}

export interface CompanyPosition {
  company: PortfolioCompany;
  positions: AllocationPosition[];
}

export function companyPositionsForInvestor(
  store: DataStore,
  investorId: string,
  companyId: string
): CompanyPosition | null {
  const company = store.companyById.get(companyId);
  if (!company) return null;
  const positions = positionsForInvestor(store, investorId).filter(
    (p) => p.deal.company_id === companyId
  );
  if (positions.length === 0) return null;
  return { company, positions };
}
