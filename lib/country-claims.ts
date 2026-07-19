import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

type CountryClaimRow = {
  country_code: string;
  claims: number | string;
};

export type CountryClaimCount = {
  countryCode: string;
  claims: number;
};

export async function getCountryClaimCounts(): Promise<
  CountryClaimCount[]
> {
  const { data, error } = await supabaseAdmin
    .from("country_claim_counts")
    .select("country_code, claims")
    .order("claims", { ascending: false });

  if (error) {
    throw new Error(
      `Unable to load country claim counts: ${error.message}`
    );
  }

  return ((data ?? []) as CountryClaimRow[])
    .map((row) => ({
      countryCode: row.country_code,
      claims: Number(row.claims)
    }))
    .filter(
      (row) =>
        /^[A-Z]{2}$/.test(row.countryCode) &&
        Number.isFinite(row.claims) &&
        row.claims > 0
    );
}

export async function getRecentClaimCount(
  since: Date
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("holder_claims")
    .select("wallet", {
      count: "exact",
      head: true
    })
    .eq("active", true)
    .gte("claimed_at", since.toISOString());

  if (error) {
    throw new Error(
      `Unable to count recent claims: ${error.message}`
    );
  }

  return count ?? 0;
}
