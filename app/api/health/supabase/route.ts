import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const [claimsResult, noncesResult] = await Promise.all([
    supabaseAdmin
      .from("holder_claims")
      .select("*", { count: "exact", head: true }),

    supabaseAdmin
      .from("claim_nonces")
      .select("*", { count: "exact", head: true })
  ]);

  if (claimsResult.error || noncesResult.error) {
    console.error("Supabase health check failed:", {
      claims: claimsResult.error,
      nonces: noncesResult.error
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Supabase database check failed",
        details: {
          holderClaims: claimsResult.error?.message ?? null,
          claimNonces: noncesResult.error?.message ?? null
        }
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    holderClaims: claimsResult.count ?? 0,
    activeNonces: noncesResult.count ?? 0
  });
}
