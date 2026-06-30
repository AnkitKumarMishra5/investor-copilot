import { reloadStore } from "../src/lib/data/loader";
import type { DataStore } from "../src/lib/data/types";
import { convert } from "../src/lib/compute/fx";
import { latestMark } from "../src/lib/compute/valuations";
import {
  computePosition,
  matchInvestorCompanies,
  positionsForInvestor,
} from "../src/lib/compute/positions";
import { getPortfolioOverview } from "../src/lib/compute/portfolio";
import { runTool } from "../src/lib/ai/tools";

export interface TestResult {
  name: string;
  pass: boolean;
  detail: string;
}

const ABS = (a: number, b: number) => Math.abs(a - b);
function approx(actual: number, expected: number, tol: number): boolean {
  return ABS(actual, expected) <= tol;
}
function ok(name: string, pass: boolean, detail: string): TestResult {
  return { name, pass, detail };
}

function investor(store: DataStore, id: string) {
  const inv = store.investorById.get(id);
  if (!inv) throw new Error(`Investor ${id} not found — is the dataset loaded?`);
  return inv;
}

export function runGolden(): TestResult[] {
  const store = reloadStore();
  const results: TestResult[] = [];
  const counts: [string, number, number][] = [
    ["investors", store.investors.length, 112],
    ["companies", store.companies.length, 16],
    ["deals", store.deals.length, 21],
    ["valuations", store.valuations.length, 55],
    ["allocations", store.allocations.length, 550],
    ["capital_calls", store.capitalCalls.length, 655],
    ["fees", store.fees.length, 1401],
    ["distributions", store.distributions.length, 34],
    ["statement_lines", store.statementLines.length, 1390],
    ["fx_rates", store.fxRates.length, 4],
  ];
  for (const [name, actual, expected] of counts) {
    results.push(
      ok(`rowcount: ${name}`, actual === expected, `expected ${expected}, got ${actual}`)
    );
  }
  results.push(
    ok("fx: GBP->USD = 1.35", approx(convert(store, 1, "GBP", "USD"), 1.35, 1e-9), `${convert(store, 1, "GBP", "USD")}`)
  );
  results.push(
    ok("fx: EUR->USD = 1.09", approx(convert(store, 1, "EUR", "USD"), 1.09, 1e-9), `${convert(store, 1, "EUR", "USD")}`)
  );
  results.push(
    ok("fx: AED->USD = 0.2723", approx(convert(store, 1, "AED", "USD"), 0.2723, 1e-9), `${convert(store, 1, "AED", "USD")}`)
  );
  results.push(
    ok(
      "fx: EUR->GBP cross via USD",
      approx(convert(store, 1, "EUR", "GBP"), 1.09 / 1.35, 1e-9),
      `${convert(store, 1, "EUR", "GBP")}`
    )
  );
  {
    const allocs = (store.allocationsByInvestor.get("INV001") ?? []).filter(
      (a) => a.deal_id === "DEAL001"
    );
    if (allocs.length !== 1) {
      results.push(ok("INV001 DEAL001 allocation exists", false, `found ${allocs.length}`));
    } else {
      const a = allocs[0];
      const p = computePosition(store, a);
      results.push(
        ok(
          "INV001 Forgecraft Seed effective_share_price ≈ 2.25",
          approx(a.effective_share_price, 2.25, 0.01),
          `${a.effective_share_price}`
        )
      );
      results.push(
        ok(
          "INV001 Forgecraft Seed units ≈ 17777.78",
          approx(a.units, 17777.78, 1),
          `${a.units}`
        )
      );
      results.push(
        ok(
          "INV001 Forgecraft Seed current value ≈ 273777.81 USD",
          approx(p.currentValue, 273777.81, 5),
          `${p.currentValue.toFixed(2)} USD`
        )
      );
      const gbp = convert(store, p.currentValue, "USD", "GBP");
      results.push(
        ok(
          "INV001 Forgecraft Seed current value ≈ 202798 GBP",
          approx(gbp, 202798, 5),
          `${gbp.toFixed(2)} GBP`
        )
      );
      const contribGbp = convert(store, p.contributed, "USD", "GBP");
      results.push(
        ok(
          "INV001 Forgecraft Seed contributed ≈ 29630 GBP",
          approx(contribGbp, 29630, 5),
          `${contribGbp.toFixed(2)} GBP`
        )
      );
    }
  }
  {
    const inv = investor(store, "INV001");
    const o = getPortfolioOverview(store, inv);
    results.push(ok("INV001 holds 4 allocations", o.dealCount === 4, `${o.dealCount}`));
    results.push(
      ok(
        "INV001 total current value ≈ 438495 GBP",
        approx(o.totalCurrentValue, 438495, 200),
        `${o.totalCurrentValue.toFixed(2)} GBP`
      )
    );
    results.push(
      ok(
        "INV001 total contributed ≈ 168593 GBP",
        approx(o.totalContributed, 168593, 200),
        `${o.totalContributed.toFixed(2)} GBP`
      )
    );
    results.push(
      ok("INV001 net distributions = 0", approx(o.totalNetDistributions, 0, 1), `${o.totalNetDistributions}`)
    );
    results.push(
      ok("INV001 MOIC ≈ 2.601", o.moic != null && approx(o.moic, 2.601, 0.01), `${o.moic}`)
    );
    results.push(ok("INV001 DPI = 0", o.dpi != null && approx(o.dpi, 0, 1e-6), `${o.dpi}`));
    results.push(
      ok("INV001 RVPI ≈ 2.601", o.rvpi != null && approx(o.rvpi, 2.601, 0.01), `${o.rvpi}`)
    );
  }
  {
    const dealsForCo = store.deals.filter((d) => d.company_id === "CO001");
    results.push(
      ok(
        "Forgecraft (CO001) has exactly 3 deals",
        dealsForCo.length === 3 && ["DEAL001", "DEAL002", "DEAL003"].every((id) => dealsForCo.some((d) => d.deal_id === id)),
        dealsForCo.map((d) => d.deal_id).join(",")
      )
    );
    const fcPositions = positionsForInvestor(store, "INV001").filter((p) => p.deal.company_id === "CO001");
    results.push(
      ok("INV001 Forgecraft position aggregates 3 rounds", fcPositions.length === 3, `${fcPositions.length}`)
    );
    const matched = matchInvestorCompanies(store, "INV001", "Forgecraft");
    results.push(ok("'Forgecraft' resolves to one company for INV001", matched.length === 1, matched.map((c) => c.company_name).join(",")));
  }
  for (const id of ["INV022", "INV023"]) {
    const positions = positionsForInvestor(store, id);
    results.push(ok(`${id} has zero allocations`, positions.length === 0, `${positions.length}`));
    const inv = investor(store, id);
    const tool = runTool(store, inv, "get_portfolio_overview", {});
    const r = tool.result as { has_holdings: boolean };
    results.push(ok(`${id} overview reports no holdings`, r.has_holdings === false, JSON.stringify(r)));
  }
  {
    const a = store.allocationById.get("ALC0542");
    if (!a) {
      results.push(ok("ALC0542 exists", false, "not found"));
    } else {
      results.push(ok("ALC0542 is Pending", a.allocation_status === "Pending", a.allocation_status));
      results.push(ok("ALC0542 contributed = 0", approx(a.contributed_amount, 0, 1e-6), `${a.contributed_amount}`));
      const p = computePosition(store, a);
      results.push(ok("ALC0542 current value = 0 (uncalled)", approx(p.currentValue, 0, 1e-6), `${p.currentValue}`));
    }
  }
  {
    const mark = latestMark(store, "DEAL010");
    const deal = store.dealById.get("DEAL010");
    if (mark && deal) {
      results.push(
        ok(
          "DEAL010 latest mark ≈ 6.2 and below entry 10.0 (down round)",
          approx(mark.value, 6.2, 0.05) && mark.value < deal.entry_share_price,
          `mark ${mark.value}, entry ${deal.entry_share_price}`
        )
      );
    } else {
      results.push(ok("DEAL010 has a mark and deal", false, "missing"));
    }
  }
  {
    const allocs = store.allocations.filter((a) => a.deal_id === "DEAL008");
    const allZero = allocs.every((a) => computePosition(store, a).currentValue === 0);
    const company = store.companyById.get("CO005");
    results.push(
      ok(
        "DEAL008 Yappio written off → current value 0 for all holders",
        allocs.length > 0 && allZero && company?.status === "Written Off",
        `${allocs.length} allocs, status ${company?.status}`
      )
    );
  }
  {
    const allocs = store.allocations.filter((a) => a.deal_id === "DEAL007");
    let valueSum = 0;
    let distSum = 0;
    for (const a of allocs) {
      const p = computePosition(store, a);
      valueSum += p.currentValue;
      distSum += p.netDistributions;
    }
    results.push(
      ok(
        "DEAL007 Helianthe exited → current value 0 but net distributions > 0",
        allocs.length > 0 && approx(valueSum, 0, 1) && distSum > 0,
        `valueSum ${valueSum.toFixed(2)}, distSum ${distSum.toFixed(2)}`
      )
    );
  }
  {
    const allocs = store.allocations.filter((a) => a.deal_id === "DEAL020");
    let foundPartial = false;
    for (const a of allocs) {
      const p = computePosition(store, a);
      if (p.realisedFraction > 0 && p.realisedFraction < 1 && p.currentValue > 0) {
        foundPartial = true;
        break;
      }
    }
    results.push(
      ok(
        "DEAL020 Tallybook has a partial secondary (realised + live value coexist)",
        foundPartial,
        foundPartial ? "found" : "no partial-and-live allocation"
      )
    );
  }
  {
    const adminFees = store.fees.filter((f) => f.fee_type === "Admin Fee");
    const allUsd = adminFees.every((f) => f.currency === "USD");
    const nonUsdDealAdmin = adminFees.filter((f) => {
      const deal = store.dealById.get(f.deal_id);
      return deal && deal.deal_currency !== "USD";
    });
    results.push(
      ok(
        "Admin fees are USD even on non-USD deals",
        adminFees.length > 0 && allUsd && nonUsdDealAdmin.length > 0,
        `${adminFees.length} admin fees, ${nonUsdDealAdmin.length} on non-USD deals, allUSD=${allUsd}`
      )
    );
  }
  {
    const inv = investor(store, "INV022");
    const tool = runTool(store, inv, "get_portfolio_overview", { investor_id: "INV001" } as Record<string, unknown>);
    const r = tool.result as { has_holdings: boolean };
    results.push(
      ok(
        "Session isolation: INV022 tool call returns only INV022 data (no holdings)",
        r.has_holdings === false && tool.sources.length === 0,
        JSON.stringify(r)
      )
    );
  }

  return results;
}
