const TOOL_LABELS: Record<string, string> = {
  get_portfolio_overview: "Pulling your portfolio",
  get_position: "Looking up your {company} position",
  get_commitment_vs_contributed: "Checking committed vs contributed",
  get_fees: "Checking your fees on {company}",
  get_upcoming_obligations: "Finding upcoming calls & fees",
  get_distributions: "Reviewing exits & payouts",
  get_valuation_history: "Tracing the {company} valuation history",
  get_account_statement: "Assembling your account statement",
  list_holdings: "Scanning your holdings",
};

function argCompany(args: Record<string, unknown>): string | undefined {
  const keys = ["company_name", "company_or_deal", "scope"] as const;
  for (const k of keys) {
    const v = args[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

export function toolLabel(tool: string, args: Record<string, unknown> = {}): string {
  const template = TOOL_LABELS[tool] ?? `Running ${tool.replace(/_/g, " ")}`;
  const company = argCompany(args);
  if (company && template.includes("{company}")) {
    return template.replace("{company}", company);
  }
  return template.replace(/\s+on\s+\{company\}/, "").replace(/\s+\{company\}/, "");
}
