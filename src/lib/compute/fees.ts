import type { Allocation, Currency, DataStore, Fee, Investor } from "../data/types";
import { convert, fxNote } from "./fx";

export interface FeeScheduleEntry {
  allocationId: string;
  dealId: string;
  companyName: string;
  round: string;
  dealCurrency: Currency;

  mgmtFeePct: number;
  stdMgmtFeePct: number;
  performanceFeePct: number;
  stdPerformanceFeePct: number;
  structuringFeePct: number;
  stdStructuringFeePct: number;
  adminFeeUsd: number;
  stdAdminFeeUsd: number;

  hasFeeDiscount: boolean;
  sources: string[];
}

export interface ChargedFee {
  feeId: string;
  feeType: string;
  period: string;
  basis: string;
  rate: number;
  amount: number;
  currency: Currency;
  amountReporting: number;
  reportingCurrency: Currency;
  dueDate: string;
  status: string;
  dealId: string;
  companyName: string;
  sources: string[];
}

export interface FeeReport {
  schedules: FeeScheduleEntry[];
  charged: ChargedFee[];
  hasAnyDiscount: boolean;
  sources: string[];
}

function scheduleFromAllocation(store: DataStore, a: Allocation): FeeScheduleEntry {
  const deal = store.dealById.get(a.deal_id)!;
  return {
    allocationId: a.allocation_id,
    dealId: a.deal_id,
    companyName: deal.company_name,
    round: deal.round,
    dealCurrency: a.deal_currency,
    mgmtFeePct: a.mgmt_fee_pct,
    stdMgmtFeePct: deal.std_mgmt_fee_pct,
    performanceFeePct: a.performance_fee_pct,
    stdPerformanceFeePct: deal.std_performance_fee_pct,
    structuringFeePct: a.structuring_fee_pct,
    stdStructuringFeePct: deal.std_structuring_fee_pct,
    adminFeeUsd: a.admin_fee_usd,
    stdAdminFeeUsd: deal.std_admin_fee_usd,
    hasFeeDiscount: a.fee_discount === "Yes",
    sources: [a.allocation_id],
  };
}

export function getFees(
  store: DataStore,
  investor: Investor,
  companyIds?: string[]
): FeeReport {
  const reporting = investor.reporting_currency;
  const allocs = store.allocationsByInvestor.get(investor.investor_id) ?? [];
  const companyFilter = companyIds ? new Set(companyIds) : null;

  const relevantAllocIds = new Set<string>();
  const schedules: FeeScheduleEntry[] = [];
  for (const a of allocs) {
    const deal = store.dealById.get(a.deal_id);
    if (!deal) continue;
    if (companyFilter && !companyFilter.has(deal.company_id)) continue;
    relevantAllocIds.add(a.allocation_id);
    schedules.push(scheduleFromAllocation(store, a));
  }

  const feeRows = store.feesByInvestor.get(investor.investor_id) ?? [];
  const charged: ChargedFee[] = [];
  for (const f of feeRows) {
    if (!relevantAllocIds.has(f.allocation_id)) continue;
    const deal = store.dealById.get(f.deal_id);
    const sources = [f.fee_id, f.allocation_id];
    const note = fxNote(f.currency, reporting);
    if (note) sources.push(note);
    charged.push({
      feeId: f.fee_id,
      feeType: f.fee_type,
      period: f.period,
      basis: f.basis,
      rate: f.fee_rate_pct,
      amount: f.amount,
      currency: f.currency,
      amountReporting: convert(store, f.amount, f.currency, reporting),
      reportingCurrency: reporting,
      dueDate: f.due_date,
      status: f.status,
      dealId: f.deal_id,
      companyName: deal?.company_name ?? f.deal_id,
      sources,
    });
  }

  const sources = new Set<string>();
  for (const s of schedules) s.sources.forEach((x) => sources.add(x));
  for (const c of charged) c.sources.forEach((x) => sources.add(x));

  return {
    schedules,
    charged,
    hasAnyDiscount: schedules.some((s) => s.hasFeeDiscount),
    sources: [...sources],
  };
}

export function unpaidFees(store: DataStore, investor: Investor): ChargedFee[] {
  const reporting = investor.reporting_currency;
  const feeRows = store.feesByInvestor.get(investor.investor_id) ?? [];
  const out: ChargedFee[] = [];
  for (const f of feeRows) {
    if (f.status !== "Upcoming" && f.status !== "Overdue") continue;
    const deal = store.dealById.get(f.deal_id);
    const sources = [f.fee_id, f.allocation_id];
    const note = fxNote(f.currency, reporting);
    if (note) sources.push(note);
    out.push({
      feeId: f.fee_id,
      feeType: f.fee_type,
      period: f.period,
      basis: f.basis,
      rate: f.fee_rate_pct,
      amount: f.amount,
      currency: f.currency,
      amountReporting: convert(store, f.amount, f.currency, reporting),
      reportingCurrency: reporting,
      dueDate: f.due_date,
      status: f.status,
      dealId: f.deal_id,
      companyName: deal?.company_name ?? f.deal_id,
      sources,
    });
  }
  return out;
}
