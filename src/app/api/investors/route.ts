import { NextResponse } from "next/server";
import { getStore } from "@/lib/data/loader";

export const runtime = "nodejs";

export async function GET() {
  try {
    const store = getStore();
    const investors = store.investors.map((i) => ({
      investor_id: i.investor_id,
      investor_name: i.investor_name,
      reporting_currency: i.reporting_currency,
      tech_savviness: i.tech_savviness,
      age: i.age,
      kyc_status: i.kyc_status,
    }));
    return NextResponse.json({ investors });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
