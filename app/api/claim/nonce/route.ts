import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { COUNTRY_CODE_SET } from "@/lib/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE58_WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const COUNTRY_CODE_RE = /^[A-Z]{2}$/;
const NONCE_LIFETIME_MS = 5 * 60 * 1000;

type NonceRequestBody = {
  wallet?: unknown;
  countryCode?: unknown;
};

export async function POST(request: NextRequest) {
  let body: NonceRequestBody;

  try {
    body = (await request.json()) as NonceRequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const wallet =
    typeof body.wallet === "string" ? body.wallet.trim() : "";

  const countryCode =
    typeof body.countryCode === "string"
      ? body.countryCode.trim().toUpperCase()
      : "";

  if (!BASE58_WALLET_RE.test(wallet)) {
    return NextResponse.json(
      { ok: false, error: "Invalid Solana wallet address" },
      { status: 400 }
    );
  }

  if (!COUNTRY_CODE_RE.test(countryCode) || !COUNTRY_CODE_SET.has(countryCode)) {
    return NextResponse.json(
      { ok: false, error: "Invalid country code" },
      { status: 400 }
    );
  }

  const nonce = crypto.randomUUID();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + NONCE_LIFETIME_MS);

  const message = [
    "ANSEM WORLD",
    "",
    "Claim your place on the $ANSEM world map.",
    "",
    `Wallet: ${wallet}`,
    `Country: ${countryCode}`,
    `Nonce: ${nonce}`,
    `Issued at: ${issuedAt.toISOString()}`,
    `Expires at: ${expiresAt.toISOString()}`,
    "",
    "This signature proves wallet ownership only.",
    "It does not authorize a transaction or transfer."
  ].join("\n");

  const { error } = await supabaseAdmin
    .from("claim_nonces")
    .insert({
      nonce,
      wallet,
      country_code: countryCode,
      message,
      expires_at: expiresAt.toISOString()
    });

  if (error) {
    console.error("Nonce insertion failed:", error);

    return NextResponse.json(
      { ok: false, error: "Unable to create signing request" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      nonce,
      wallet,
      countryCode,
      message,
      expiresAt: expiresAt.toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
