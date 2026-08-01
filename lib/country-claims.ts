import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

type CountryClaimRow = {
  country_code: string;
  claims: number | string;
};

type MapCountryCountRow = {
  country_code: string;
  community_bulls: number | string;
  verified_bulls: number | string;
  total_bulls: number | string;
};

export type CountryClaimCount = {
  countryCode: string;
  claims: number;
};

export type MapCountryCount = {
  countryCode: string;
  claims: number;
  communityBulls: number;
  verifiedBulls: number;
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

export async function getMapCountryCounts(): Promise<
  MapCountryCount[]
> {
  const { data, error } = await supabaseAdmin
    .from("map_country_counts")
    .select(
      "country_code, community_bulls, verified_bulls, total_bulls"
    )
    .order("total_bulls", { ascending: false });

  if (error) {
    throw new Error(
      `Unable to load map country counts: ${error.message}`
    );
  }

  return ((data ?? []) as MapCountryCountRow[])
    .map((row) => ({
      countryCode: row.country_code,
      claims: Number(row.total_bulls),
      communityBulls: Number(row.community_bulls),
      verifiedBulls: Number(row.verified_bulls)
    }))
    .filter(
      (row) =>
        /^[A-Z]{2}$/.test(row.countryCode) &&
        Number.isFinite(row.claims) &&
        Number.isFinite(row.communityBulls) &&
        Number.isFinite(row.verifiedBulls) &&
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
