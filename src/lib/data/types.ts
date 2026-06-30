export type Currency = "USD" | "GBP" | "EUR" | "AED";

export type TechSavviness = "Low" | "Medium" | "High";
export type KycStatus = "Verified" | "Pending";
export type CompanyStatus = "Active" | "Exited" | "Written Off";
export type AllocationStatus = "Active" | "Pending";
export type CallStatus = "Paid" | "Upcoming";
export type FeeType = "Management Fee" | "Structuring Fee" | "Admin Fee" | "Performance Fee";
export type FeeBasis = "Commitment" | "Flat";
export type FeeStatus = "Paid" | "Upcoming" | "Overdue";
export type DistributionType = "Exit Proceeds" | "Secondary Sale";

export interface Investor {
  investor_id: string;
  investor_name: string;
  investor_type: string;
  country: string;
  reporting_currency: Currency;
  age: number;
  tech_savviness: TechSavviness;
  kyc_status: KycStatus;
  onboarded_date: string;
  email: string;
}

export interface PortfolioCompany {
  company_id: string;
  company_name: string;
  sector: string;
  hq_country: string;
  status: CompanyStatus;
  website: string;
}

export interface Deal {
  deal_id: string;
  company_id: string;
  company_name: string;
  round: string;
  instrument: string;
  spv_name: string;
  deal_currency: Currency;
  deal_date: string;
  pre_money_valuation_m: number;
  post_money_valuation_m: number;
  round_size_m: number;
  fund_allocation_m: number;
  entry_share_price: number;
  contributed_pct: number;
  std_mgmt_fee_pct: number;
  std_performance_fee_pct: number;
  std_structuring_fee_pct: number;
  std_admin_fee_usd: number;
  status: CompanyStatus;
}

export interface Valuation {
  valuation_id: string;
  deal_id: string;
  valuation_date: string;
  share_price: number;
  company_valuation_m: number;
  mark_source: string;
  multiple_vs_entry: number;
}

export interface Allocation {
  allocation_id: string;
  deal_id: string;
  investor_id: string;
  deal_currency: Currency;
  commitment_amount: number;
  price_discount_pct: number;
  effective_share_price: number;
  units: number;
  contributed_amount: number;
  outstanding_commitment: number;
  mgmt_fee_pct: number;
  performance_fee_pct: number;
  structuring_fee_pct: number;
  admin_fee_usd: number;
  fee_discount: "Yes" | "No";
  allocation_status: AllocationStatus;
  allocation_date: string;
}

export interface CapitalCall {
  call_id: string;
  allocation_id: string;
  investor_id: string;
  deal_id: string;
  call_number: number;
  call_date: string;
  amount: number;
  currency: Currency;
  due_date: string;
  status: CallStatus;
}

export interface Fee {
  fee_id: string;
  allocation_id: string;
  investor_id: string;
  deal_id: string;
  fee_type: FeeType;
  period: string;
  fee_rate_pct: number;
  basis: FeeBasis;
  amount: number;
  currency: Currency;
  due_date: string;
  status: FeeStatus;
}

export interface Distribution {
  distribution_id: string;
  deal_id: string;
  allocation_id: string;
  investor_id: string;
  distribution_date: string;
  distribution_type: DistributionType;
  gross_amount: number;
  performance_fee_pct: number;
  performance_fee_amount: number;
  net_amount: number;
  currency: Currency;
  fraction_of_units: number;
}

export interface StatementLine {
  line_id: string;
  investor_id: string;
  date: string;
  type: string;
  deal_id: string;
  amount: number;
  currency: Currency;
  reference_id: string;
}

export interface FxRate {
  currency: Currency;
  to_usd: number;
  as_of: string;
}

export interface DataStore {
  investors: Investor[];
  companies: PortfolioCompany[];
  deals: Deal[];
  valuations: Valuation[];
  allocations: Allocation[];
  capitalCalls: CapitalCall[];
  fees: Fee[];
  distributions: Distribution[];
  statementLines: StatementLine[];
  fxRates: FxRate[];

  investorById: Map<string, Investor>;
  companyById: Map<string, PortfolioCompany>;
  dealById: Map<string, Deal>;
  valuationsByDeal: Map<string, Valuation[]>;
  allocationsByInvestor: Map<string, Allocation[]>;
  allocationById: Map<string, Allocation>;
  callsByInvestor: Map<string, CapitalCall[]>;
  feesByInvestor: Map<string, Fee[]>;
  distributionsByInvestor: Map<string, Distribution[]>;
  distributionsByAllocation: Map<string, Distribution[]>;
  statementByInvestor: Map<string, StatementLine[]>;
  fxByCurrency: Map<Currency, FxRate>;
}

export interface Sourced<T> {
  value: T;
  sources: string[];
}
