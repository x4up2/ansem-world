import { NextResponse } from "next/server";

import {
  getCountryClaimCounts,
  getRecentClaimCount
} from "@/lib/country-claims";

import {
  getLatestHolderSnapshot
} from "@/lib/holder-snapshot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const snapshot =
      await getLatestHolderSnapshot();

    let countryClaims:
      Awaited<
        ReturnType<
          typeof getCountryClaimCounts
        >
      > = [];

    let last24h = 0;
    let claimsAvailable = true;

    try {
      const since = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      );

      [countryClaims, last24h] =
        await Promise.all([
          getCountryClaimCounts(),
          getRecentClaimCount(since)
        ]);
    } catch (error) {
      claimsAvailable = false;

      console.error(
        "Unable to load live claim statistics:",
        error
      );
    }

    const mappedHolders =
      countryClaims.reduce(
        (total, country) =>
          total + country.claims,
        0
      );

    return NextResponse.json(
      {
        totalHolders:
          snapshot.holderCount,

        tokenAccountCount:
          snapshot.tokenAccountCount,

        mappedHolders,
        countries: countryClaims.length,
        last24h,

        generatedAt:
          snapshot.generatedAt,

        slot:
          snapshot.slot,

        snapshotSource:
          snapshot.source,

        liveUpdatedAt:
          new Date().toISOString(),

        mode: claimsAvailable
          ? "supabase-snapshot+live-claims"
          : "supabase-snapshot"
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0"
        }
      }
    );
  } catch (error) {
    console.error(
      "Unable to load holder statistics:",
      error
    );

    return NextResponse.json(
      {
        totalHolders: 0,
        tokenAccountCount: null,
        mappedHolders: 0,
        countries: 0,
        last24h: 0,
        generatedAt: null,
        slot: null,
        snapshotSource: null,
        liveUpdatedAt: null,
        mode: "unavailable"
      },
      {
        status: 503,
        headers: {
          "Cache-Control":
            "no-store, max-age=0"
        }
      }
    );
  }
}
