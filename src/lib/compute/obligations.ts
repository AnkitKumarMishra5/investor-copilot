import type { Currency, DataStore, Investor } from "../data/types";
import { convert, fxNote } from "./fx";
import { unpaidFees } from "./fees";

export interface ObligationItem {
  kind: "Capital Call" | "Management Fee" | "Structuring Fee" | "Admin Fee" | "Fee";
  refId: string;
  dealId: string;
  companyName: string;
  amount: number;
  currency: Currency;
  amountReporting: number;
  reportingCurrency: Currency;
  dueDate: string;
  status: string;
  sources: string[];
}

export interface ObligationsReport {
  reportingCurrency: Currency;
  items: ObligationItem[];
  totalUpcomingReporting: number;
  totalOverdueReporting: number;
  sources: string[];
}

export function getUpcomingObligations(
  store: DataStore,
  investor: Investor
): ObligationsReport {
  const reporting = investor.reporting_currency;
  const items: ObligationItem[] = [];

  const calls = store.callsByInvestor.get(investor.investor_id) ?? [];
  for (const c of calls) {
    if (c.status !== "Upcoming") continue;
    const deal = store.dealById.get(c.deal_id);
    const sources = [c.call_id, c.allocation_id];
    const note = fxNote(c.currency, reporting);
    if (note) sources.push(note);
    items.push({
      kind: "Capital Call",
      refId: c.call_id,
      dealId: c.deal_id,
      companyName: deal?.company_name ?? c.deal_id,
      amount: c.amount,
      currency: c.currency,
      amountReporting: convert(store, c.amount, c.currency, reporting),
      reportingCurrency: reporting,
      dueDate: c.due_date,
      status: c.status,
      sources,
    });
  }

  for (const f of unpaidFees(store, investor)) {
    const kind: ObligationItem["kind"] =
      f.feeType === "Management Fee"
        ? "Management Fee"
        : f.feeType === "Structuring Fee"
        ? "Structuring Fee"
        : f.feeType === "Admin Fee"
        ? "Admin Fee"
        : "Fee";
    items.push({
      kind,
      refId: f.feeId,
      dealId: f.dealId,
      companyName: f.companyName,
      amount: f.amount,
      currency: f.currency,
      amountReporting: f.amountReporting,
      reportingCurrency: reporting,
      dueDate: f.dueDate,
      status: f.status,
      sources: f.sources,
    });
  }

  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  let totalUpcoming = 0;
  let totalOverdue = 0;
  const sources = new Set<string>();
  for (const it of items) {
    if (it.status === "Overdue") totalOverdue += it.amountReporting;
    else totalUpcoming += it.amountReporting;
    it.sources.forEach((s) => sources.add(s));
  }

  return {
    reportingCurrency: reporting,
    items,
    totalUpcomingReporting: totalUpcoming,
    totalOverdueReporting: totalOverdue,
    sources: [...sources],
  };
}
