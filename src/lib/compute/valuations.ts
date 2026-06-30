import type { DataStore, Sourced, Valuation } from "../data/types";

export function latestMark(
  store: DataStore,
  dealId: string
): Sourced<number> | null {
  const rows = store.valuationsByDeal.get(dealId);
  if (!rows || rows.length === 0) return null;
  const latest = rows[rows.length - 1];
  return { value: latest.share_price, sources: [latest.valuation_id] };
}

export function valuationHistory(store: DataStore, dealId: string): Valuation[] {
  return store.valuationsByDeal.get(dealId) ?? [];
}
