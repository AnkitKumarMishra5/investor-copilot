import type { DataStore, Investor, TechSavviness } from "../data/types";
import { positionsForInvestor } from "./positions";

export interface InvestorProfile {
  investorId: string;
  name: string;
  reportingCurrency: string;
  age: number;
  techSavviness: TechSavviness;
  kycStatus: string;
  investorType: string;

  dealCount: number;
  companyCount: number;
  pendingCount: number;
  topSectors: { sector: string; count: number }[];

  hasHoldings: boolean;
}

export function getProfile(store: DataStore, investor: Investor): InvestorProfile {
  const positions = positionsForInvestor(store, investor.investor_id);

  const sectorCounts = new Map<string, number>();
  const companies = new Set<string>();
  let pendingCount = 0;

  for (const p of positions) {
    companies.add(p.deal.company_id);
    if (p.isPending) pendingCount += 1;
    const sector = p.company?.sector;
    if (sector) sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
  }

  const topSectors = [...sectorCounts.entries()]
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    investorId: investor.investor_id,
    name: investor.investor_name,
    reportingCurrency: investor.reporting_currency,
    age: investor.age,
    techSavviness: investor.tech_savviness,
    kycStatus: investor.kyc_status,
    investorType: investor.investor_type,
    dealCount: positions.length,
    companyCount: companies.size,
    pendingCount,
    topSectors,
    hasHoldings: positions.length > 0,
  };
}
