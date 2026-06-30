import type { Currency, DataStore } from "../data/types";

export function convert(
  store: DataStore,
  amount: number,
  from: Currency,
  to: Currency
): number {
  if (from === to) return amount;
  const fromRate = store.fxByCurrency.get(from);
  const toRate = store.fxByCurrency.get(to);
  if (!fromRate) throw new Error(`Unknown source currency: ${from}`);
  if (!toRate) throw new Error(`Unknown target currency: ${to}`);
  return (amount * fromRate.to_usd) / toRate.to_usd;
}

export function fxNote(from: Currency, to: Currency): string | null {
  if (from === to) return null;
  return `fx:${from}->${to}`;
}
