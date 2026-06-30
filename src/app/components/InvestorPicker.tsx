"use client";

import type { InvestorSummary } from "./types";

interface Props {
  investors: InvestorSummary[];
  selectedId: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function InvestorPicker({ investors, selectedId, onChange, disabled }: Props) {
  const selected = investors.find((i) => i.investor_id === selectedId);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="investor" className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        Logged in as
      </label>
      <div className="flex items-center gap-3">
        <select
          id="investor"
          value={selectedId}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-[16rem] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
        >
          {investors.map((i) => (
            <option key={i.investor_id} value={i.investor_id}>
              {i.investor_name} · {i.investor_id} · {i.reporting_currency}
            </option>
          ))}
        </select>
        {selected && (
          <span className="hidden text-xs text-ink-faint sm:inline">
            {selected.tech_savviness} tech-savviness · age {selected.age} · KYC {selected.kyc_status}
          </span>
        )}
      </div>
    </div>
  );
}
