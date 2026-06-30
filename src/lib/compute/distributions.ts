import type { Currency, DataStore, Investor } from "../data/types";
import { convert, fxNote } from "./fx";

export interface DistributionItem {
  distributionId: string;
  dealId: string;
  allocationId: string;
  companyName: string;
  date: string;
  type: string;
  grossAmount: number;
  performanceFeePct: number;
  performanceFeeAmount: number;
  netAmount: number;
  currency: Currency;
  netAmountReporting: number;
  grossAmountReporting: number;
  fractionOfUnits: number;
  reportingCurrency: Currency;
  sources: string[];
}

export interface DistributionsReport {
  reportingCurrency: Currency;
  items: DistributionItem[];
  totalGrossReporting: number;
  totalCarryReporting: number;
  totalNetReporting: number;
  sources: string[];
}

export function getDistributions(
  store: DataStore,
  investor: Investor,
  companyIds?: string[]
): DistributionsReport {
  const reporting = investor.reporting_currency;
  const rows = store.distributionsByInvestor.get(investor.investor_id) ?? [];
  const companyFilter = companyIds ? new Set(companyIds) : null;

  const items: DistributionItem[] = [];
  let totalGross = 0;
  let totalCarry = 0;
  let totalNet = 0;
  const sources = new Set<string>();

  for (const d of rows) {
    const deal = store.dealById.get(d.deal_id);
    if (companyFilter && (!deal || !companyFilter.has(deal.company_id))) continue;

    const itemSources = [d.distribution_id, d.allocation_id];
    const note = fxNote(d.currency, reporting);
    if (note) itemSources.push(note);

    const netReporting = convert(store, d.net_amount, d.currency, reporting);
    const grossReporting = convert(store, d.gross_amount, d.currency, reporting);
    const carryReporting = convert(store, d.performance_fee_amount, d.currency, reporting);

    totalGross += grossReporting;
    totalCarry += carryReporting;
    totalNet += netReporting;
    itemSources.forEach((s) => sources.add(s));

    items.push({
      distributionId: d.distribution_id,
      dealId: d.deal_id,
      allocationId: d.allocation_id,
      companyName: deal?.company_name ?? d.deal_id,
      date: d.distribution_date,
      type: d.distribution_type,
      grossAmount: d.gross_amount,
      performanceFeePct: d.performance_fee_pct,
      performanceFeeAmount: d.performance_fee_amount,
      netAmount: d.net_amount,
      currency: d.currency,
      netAmountReporting: netReporting,
      grossAmountReporting: grossReporting,
      fractionOfUnits: d.fraction_of_units,
      reportingCurrency: reporting,
      sources: itemSources,
    });
  }

  items.sort((a, b) => a.date.localeCompare(b.date));

  return {
    reportingCurrency: reporting,
    items,
    totalGrossReporting: totalGross,
    totalCarryReporting: totalCarry,
    totalNetReporting: totalNet,
    sources: [...sources],
  };
}
