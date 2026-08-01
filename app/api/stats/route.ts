import { NextResponse } from "next/server";

import {
  getMapCountryCounts,
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

    let countryBulls:
      Awaited<
        ReturnType<
          typeof getMapCountryCounts
        >
      > = [];

    let last24h = 0;
    let mapAvailable = true;

    try {
      const since = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      );

      [countryBulls, last24h] =
        await Promise.all([
          getMapCountryCounts(),
          getRecentClaimCount(since)
        ]);
    } catch (error) {
      mapAvailable = false;

      console.error(
        "Unable to load live map statistics:",
        error
      );
    }

    const mappedBulls =
      countryBulls.reduce(
        (total, country) =>
          total + country.claims,
        0
      );

    const verifiedHolders =
      countryBulls.reduce(
        (total, country) =>
          total + country.verifiedBulls,
        0
      );

    const communityBulls =
      countryBulls.reduce(
        (total, country) =>
          total + country.communityBulls,
        0
      );

    return NextResponse.json(
      {
        totalHolders:
          snapshot.holderCount,

        tokenAccountCount:
          snapshot.tokenAccountCount,

        mappedHolders: mappedBulls,
        mappedBulls,
        verifiedHolders,
        communityBulls,
        countries: countryBulls.length,
        last24h,

        generatedAt:
          snapshot.generatedAt,

        slot:
          snapshot.slot,

        snapshotSource:
          snapshot.source,

        liveUpdatedAt:
          new Date().toISOString(),

        mode: mapAvailable
          ? "supabase-snapshot+community-map"
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
        mappedBulls: 0,
        verifiedHolders: 0,
        communityBulls: 0,
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
