import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import type {
  Allocation,
  CapitalCall,
  Currency,
  DataStore,
  Deal,
  Distribution,
  Fee,
  FxRate,
  Investor,
  PortfolioCompany,
  StatementLine,
  Valuation,
} from "./types";

const EXPECTED_COUNTS: Record<string, number> = {
  "investors.csv": 112,
  "portfolio_companies.csv": 16,
  "deals.csv": 21,
  "valuations.csv": 55,
  "allocations.csv": 550,
  "capital_calls.csv": 655,
  "fees.csv": 1401,
  "distributions.csv": 34,
  "statement_lines.csv": 1390,
  "fx_rates.csv": 4,
};

const DATA_DIR = path.join(process.cwd(), "data");

function readCsv<T>(file: string, numericColumns: string[]): T[] {
  const fullPath = path.join(DATA_DIR, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `Missing data file: ${file}. Expected the dataset at ${DATA_DIR}. ` +
        `Drop the provided CSV folder in at the repo root as /data.`
    );
  }
  const raw = fs.readFileSync(fullPath, "utf8");
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    const sample = parsed.errors.slice(0, 3).map((e) => e.message).join("; ");
    console.warn(`[loader] ${file}: ${parsed.errors.length} parse warning(s): ${sample}`);
  }

  const numericSet = new Set(numericColumns);
  const rows = parsed.data.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(row)) {
      const trimmed = typeof val === "string" ? val.trim() : val;
      if (numericSet.has(key)) {
        out[key] = trimmed === "" || trimmed == null ? 0 : Number(trimmed);
      } else {
        out[key] = trimmed;
      }
    }
    return out as T;
  });

  const expected = EXPECTED_COUNTS[file];
  if (expected != null && rows.length !== expected) {
    console.warn(
      `[loader] ${file}: expected ${expected} rows, found ${rows.length}.`
    );
  }
  return rows;
}

function indexBy<T>(rows: T[], key: (row: T) => string): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) m.set(key(r), r);
  return m;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = m.get(k);
    if (arr) arr.push(r);
    else m.set(k, [r]);
  }
  return m;
}

function buildStore(): DataStore {
  const investors = readCsv<Investor>("investors.csv", ["age"]);
  const companies = readCsv<PortfolioCompany>("portfolio_companies.csv", []);
  const deals = readCsv<Deal>("deals.csv", [
    "pre_money_valuation_m",
    "post_money_valuation_m",
    "round_size_m",
    "fund_allocation_m",
    "entry_share_price",
    "contributed_pct",
    "std_mgmt_fee_pct",
    "std_performance_fee_pct",
    "std_structuring_fee_pct",
    "std_admin_fee_usd",
  ]);
  const valuations = readCsv<Valuation>("valuations.csv", [
    "share_price",
    "company_valuation_m",
    "multiple_vs_entry",
  ]);
  const allocations = readCsv<Allocation>("allocations.csv", [
    "commitment_amount",
    "price_discount_pct",
    "effective_share_price",
    "units",
    "contributed_amount",
    "outstanding_commitment",
    "mgmt_fee_pct",
    "performance_fee_pct",
    "structuring_fee_pct",
    "admin_fee_usd",
  ]);
  const capitalCalls = readCsv<CapitalCall>("capital_calls.csv", [
    "call_number",
    "amount",
  ]);
  const fees = readCsv<Fee>("fees.csv", ["fee_rate_pct", "amount"]);
  const distributions = readCsv<Distribution>("distributions.csv", [
    "gross_amount",
    "performance_fee_pct",
    "performance_fee_amount",
    "net_amount",
    "fraction_of_units",
  ]);
  const statementLines = readCsv<StatementLine>("statement_lines.csv", ["amount"]);
  const fxRates = readCsv<FxRate>("fx_rates.csv", ["to_usd"]);

  const valuationsByDeal = groupBy(valuations, (v) => v.deal_id);
  for (const arr of valuationsByDeal.values()) {
    arr.sort((a, b) => a.valuation_date.localeCompare(b.valuation_date));
  }

  return {
    investors,
    companies,
    deals,
    valuations,
    allocations,
    capitalCalls,
    fees,
    distributions,
    statementLines,
    fxRates,

    investorById: indexBy(investors, (r) => r.investor_id),
    companyById: indexBy(companies, (r) => r.company_id),
    dealById: indexBy(deals, (r) => r.deal_id),
    valuationsByDeal,
    allocationsByInvestor: groupBy(allocations, (r) => r.investor_id),
    allocationById: indexBy(allocations, (r) => r.allocation_id),
    callsByInvestor: groupBy(capitalCalls, (r) => r.investor_id),
    feesByInvestor: groupBy(fees, (r) => r.investor_id),
    distributionsByInvestor: groupBy(distributions, (r) => r.investor_id),
    distributionsByAllocation: groupBy(distributions, (r) => r.allocation_id),
    statementByInvestor: groupBy(statementLines, (r) => r.investor_id),
    fxByCurrency: indexBy(fxRates, (r) => r.currency) as Map<Currency, FxRate>,
  };
}

declare global {
  var __INVESTOR_COPILOT_STORE__: DataStore | undefined;
}

export function getStore(): DataStore {
  if (!globalThis.__INVESTOR_COPILOT_STORE__) {
    globalThis.__INVESTOR_COPILOT_STORE__ = buildStore();
  }
  return globalThis.__INVESTOR_COPILOT_STORE__;
}

export function reloadStore(): DataStore {
  globalThis.__INVESTOR_COPILOT_STORE__ = buildStore();
  return globalThis.__INVESTOR_COPILOT_STORE__;
}
