import type { Currency, DataStore, Investor } from "../data/types";
import { convert, fxNote } from "./fx";

export interface StatementEntry {
  lineId: string;
  date: string;
  type: string;
  dealId: string;
  companyName: string;
  amount: number;
  currency: Currency;
  amountReporting: number;
  referenceId: string;
  sources: string[];
}

export interface StatementReport {
  reportingCurrency: Currency;
  entries: StatementEntry[];
  totalInflowReporting: number; // positive amounts (cash in to investor)
  totalOutflowReporting: number; // negative amounts (cash out), reported as positive magnitude
  netReporting: number;
  byType: Record<string, number>; // net by type, in reporting currency
  sources: string[];
}

export function getAccountStatement(
  store: DataStore,
  investor: Investor,
  filter?: string
): StatementReport {
  const reporting = investor.reporting_currency;
  const rows = store.statementByInvestor.get(investor.investor_id) ?? [];
  const f = filter?.trim().toLowerCase();

  const entries: StatementEntry[] = [];
  let inflow = 0;
  let outflow = 0;
  const byType: Record<string, number> = {};
  const sources = new Set<string>();

  for (const r of rows) {
    if (f && !r.type.toLowerCase().includes(f)) continue;
    const deal = r.deal_id ? store.dealById.get(r.deal_id) : undefined;
    const amtReporting = convert(store, r.amount, r.currency, reporting);
    const lineSources = [r.line_id];
    const note = fxNote(r.currency, reporting);
    if (note) lineSources.push(note);

    if (amtReporting >= 0) inflow += amtReporting;
    else outflow += -amtReporting;
    byType[r.type] = (byType[r.type] ?? 0) + amtReporting;
    lineSources.forEach((s) => sources.add(s));

    entries.push({
      lineId: r.line_id,
      date: r.date,
      type: r.type,
      dealId: r.deal_id,
      companyName: deal?.company_name ?? r.deal_id ?? "",
      amount: r.amount,
      currency: r.currency,
      amountReporting: amtReporting,
      referenceId: r.reference_id,
      sources: lineSources,
    });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));

  return {
    reportingCurrency: reporting,
    entries,
    totalInflowReporting: inflow,
    totalOutflowReporting: outflow,
    netReporting: inflow - outflow,
    byType,
    sources: [...sources],
  };
}
