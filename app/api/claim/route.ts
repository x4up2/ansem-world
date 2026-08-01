import {
  createHash,
  createHmac
} from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { COUNTRY_CODE_SET } from "@/lib/countries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANSEM_MINT =
  "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VERIFICATION_TOKEN_RE =
  /^[0-9a-f]{64}$/i;

type ClaimBody = {
  nonce?: unknown;
  wallet?: unknown;
  countryCode?: unknown;
  message?: unknown;
  signature?: unknown;
  verificationToken?: unknown;
};

type TokenAccount = {
  account?: {
    data?: {
      parsed?: {
        info?: {
          tokenAmount?: {
            amount?: string;
          };
        };
      };
    };
  };
};

type RpcResponse = {
  result?: {
    context?: {
      slot?: number;
    };
    value?: TokenAccount[];
  };
  error?: {
    code?: number;
    message?: string;
  };
};

function errorResponse(error: string, status: number) {
  return NextResponse.json(
    {
      ok: false,
      error
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

async function getAnsemBalance(wallet: string) {
  if (!HELIUS_API_KEY) {
    throw new Error("HELIUS_API_KEY is missing");
  }

  const rpcResponse = await fetch(
    `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(
      HELIUS_API_KEY
    )}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "ansem-world-balance-check",
        method: "getTokenAccountsByOwner",
        params: [
          wallet,
          {
            mint: ANSEM_MINT
          },
          {
            commitment: "confirmed",
            encoding: "jsonParsed"
          }
        ]
      })
    }
  );

  if (!rpcResponse.ok) {
    throw new Error(
      `Helius returned HTTP ${rpcResponse.status}`
    );
  }

  const payload = (await rpcResponse.json()) as RpcResponse;

  if (payload.error) {
    throw new Error(
      payload.error.message ??
        `RPC error ${payload.error.code ?? "unknown"}`
    );
  }

  let balanceRaw = 0n;

  for (const tokenAccount of payload.result?.value ?? []) {
    const amount =
      tokenAccount.account?.data?.parsed?.info?.tokenAmount
        ?.amount ?? "0";

    balanceRaw += BigInt(amount);
  }

  return {
    balanceRaw,
    slot: payload.result?.context?.slot ?? null
  };
}

export async function POST(request: NextRequest) {
  let body: ClaimBody;

  try {
    body = (await request.json()) as ClaimBody;
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }

  const nonce =
    typeof body.nonce === "string"
      ? body.nonce.trim()
      : "";

  const wallet =
    typeof body.wallet === "string"
      ? body.wallet.trim()
      : "";

  const countryCode =
    typeof body.countryCode === "string"
      ? body.countryCode.trim().toUpperCase()
      : "";

  const message =
    typeof body.message === "string"
      ? body.message
      : "";

  const verificationToken =
    typeof body.verificationToken === "string"
      ? body.verificationToken.trim()
      : "";

  const signature = body.signature;

  if (!UUID_RE.test(nonce)) {
    return errorResponse("Invalid nonce.", 400);
  }

  if (!WALLET_RE.test(wallet)) {
    return errorResponse(
      "Invalid Solana wallet address.",
      400
    );
  }

  if (!COUNTRY_CODE_SET.has(countryCode)) {
    return errorResponse(
      "Unsupported country code.",
      400
    );
  }

  if (message.length === 0 || message.length > 2000) {
    return errorResponse(
      "Invalid signing message.",
      400
    );
  }

  if (
    verificationToken &&
    !VERIFICATION_TOKEN_RE.test(
      verificationToken
    )
  ) {
    return errorResponse(
      "Invalid mobile verification token.",
      400
    );
  }

  if (
    !Array.isArray(signature) ||
    signature.length !== 64 ||
    !signature.every(
      (value) =>
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 255
    )
  ) {
    return errorResponse(
      "Invalid signature format.",
      400
    );
  }

  let walletPublicKey: Uint8Array;

  try {
    walletPublicKey = bs58.decode(wallet);
  } catch {
    return errorResponse(
      "Invalid wallet encoding.",
      400
    );
  }

  if (walletPublicKey.length !== 32) {
    return errorResponse(
      "Invalid wallet public key.",
      400
    );
  }

  const { data: nonceRow, error: nonceError } =
    await supabaseAdmin
      .from("claim_nonces")
      .select(
        "nonce, wallet, country_code, message, expires_at, used_at"
      )
      .eq("nonce", nonce)
      .maybeSingle();

  if (nonceError) {
    console.error("Nonce lookup failed:", nonceError);

    return errorResponse(
      "Unable to verify the signing request.",
      500
    );
  }

  if (!nonceRow) {
    return errorResponse(
      "Signing request not found. Please start again.",
      404
    );
  }

  if (nonceRow.used_at) {
    return errorResponse(
      "This signing request has already been used.",
      409
    );
  }

  if (
    nonceRow.wallet !== wallet ||
    nonceRow.country_code !== countryCode ||
    nonceRow.message !== message
  ) {
    return errorResponse(
      "The signed message does not match the stored request.",
      400
    );
  }

  if (
    new Date(nonceRow.expires_at).getTime() <= Date.now()
  ) {
    return errorResponse(
      "The signing request has expired. Please try again.",
      410
    );
  }

  const signatureIsValid = nacl.sign.detached.verify(
    new TextEncoder().encode(message),
    Uint8Array.from(signature),
    walletPublicKey
  );

  if (!signatureIsValid) {
    return errorResponse(
      "The wallet signature is invalid.",
      401
    );
  }

  let handoffCommunityBullId:
    string | null = null;

  let handoffTokenHash:
    string | null = null;

  if (verificationToken) {
    handoffTokenHash = createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    const {
      data: verificationTokenRow,
      error: verificationTokenError
    } = await supabaseAdmin
      .from(
        "community_bull_verification_tokens"
      )
      .select(
        "community_bull_id, expires_at, used_at"
      )
      .eq(
        "token_hash",
        handoffTokenHash
      )
      .maybeSingle();

    if (verificationTokenError) {
      console.error(
        "Mobile verification token lookup failed:",
        verificationTokenError
      );

      return errorResponse(
        "Unable to validate the mobile verification link.",
        500
      );
    }

    if (!verificationTokenRow) {
      return errorResponse(
        "The mobile verification link was not found.",
        404
      );
    }

    if (verificationTokenRow.used_at) {
      return errorResponse(
        "This mobile verification link has already been used.",
        409
      );
    }

    if (
      new Date(
        verificationTokenRow.expires_at
      ).getTime() <= Date.now()
    ) {
      return errorResponse(
        "This mobile verification link has expired. Please return to your original browser and try again.",
        410
      );
    }

    const {
      data: handoffBull,
      error: handoffBullError
    } = await supabaseAdmin
      .from("community_bulls")
      .select("id, country_code, status")
      .eq(
        "id",
        verificationTokenRow.community_bull_id
      )
      .maybeSingle();

    if (handoffBullError) {
      console.error(
        "Mobile verification bull lookup failed:",
        handoffBullError
      );

      return errorResponse(
        "Unable to validate the associated community bull.",
        500
      );
    }

    if (!handoffBull) {
      return errorResponse(
        "The associated community bull no longer exists.",
        404
      );
    }

    if (
      handoffBull.country_code !==
      countryCode
    ) {
      return errorResponse(
        "The mobile verification link does not match the selected country.",
        400
      );
    }

    if (
      handoffBull.status !== "active" &&
      handoffBull.status !== "pending"
    ) {
      return errorResponse(
        handoffBull.status === "verified"
          ? "Your bull is already verified."
          : "This community bull cannot currently be verified.",
        409
      );
    }

    handoffCommunityBullId =
      handoffBull.id;
  }

  let balanceResult: {
    balanceRaw: bigint;
    slot: number | null;
  };

  try {
    balanceResult = await getAnsemBalance(wallet);
  } catch (error) {
    console.error("ANSEM balance check failed:", error);

    return errorResponse(
      "Unable to verify the $ANSEM balance.",
      502
    );
  }

  if (balanceResult.balanceRaw <= 0n) {
    return errorResponse(
      "This wallet does not currently hold $ANSEM.",
      403
    );
  }

  const verifiedAt = new Date().toISOString();

  const { error: claimError } = await supabaseAdmin
    .from("holder_claims")
    .upsert(
      {
        wallet,
        country_code: countryCode,
        balance_raw: balanceResult.balanceRaw.toString(),
        verified_slot: balanceResult.slot,
        consent_version: "2026-07-v1",
        active: true,
        updated_at: verifiedAt
      },
      {
        onConflict: "wallet"
      }
    );

  if (claimError) {
    console.error("Claim saving failed:", claimError);

    return errorResponse(
      "The wallet was verified, but your participation could not be saved.",
      500
    );
  }

  if (
    handoffCommunityBullId &&
    handoffTokenHash
  ) {
    const {
      data: upgradedBull,
      error: communityBullError
    } = await supabaseAdmin
      .from("community_bulls")
      .update({
        status: "verified",
        verified_at: verifiedAt,
        updated_at: verifiedAt
      })
      .eq(
        "id",
        handoffCommunityBullId
      )
      .eq("country_code", countryCode)
      .in("status", ["active", "pending"])
      .select("id")
      .maybeSingle();

    if (
      communityBullError ||
      !upgradedBull
    ) {
      console.error(
        "Mobile community bull upgrade failed:",
        communityBullError
      );

      return errorResponse(
        "Your wallet was verified, but your community bull could not be upgraded.",
        500
      );
    }

    const {
      data: consumedToken,
      error: tokenConsumeError
    } = await supabaseAdmin
      .from(
        "community_bull_verification_tokens"
      )
      .update({
        used_at: verifiedAt
      })
      .eq(
        "token_hash",
        handoffTokenHash
      )
      .is("used_at", null)
      .select("token_hash")
      .maybeSingle();

    if (
      tokenConsumeError ||
      !consumedToken
    ) {
      console.error(
        "Mobile verification token consumption failed:",
        tokenConsumeError
      );

      return errorResponse(
        "Your bull was verified, but the mobile verification link could not be closed.",
        500
      );
    }
  } else {
    const hmacSecret =
      process.env.COMMUNITY_BULL_HMAC_SECRET;

    const browserId =
      request.cookies.get(
        "ansem_community_id"
      )?.value;

    if (
      hmacSecret &&
      browserId &&
      UUID_RE.test(browserId)
    ) {
      const browserHash = createHmac(
        "sha256",
        hmacSecret
      )
        .update(`browser:${browserId}`)
        .digest("hex");

      const { error: communityBullError } =
        await supabaseAdmin
          .from("community_bulls")
          .update({
            status: "verified",
            verified_at: verifiedAt,
            updated_at: verifiedAt
          })
          .eq(
            "browser_hash",
            browserHash
          )
          .eq(
            "country_code",
            countryCode
          )
          .in(
            "status",
            ["active", "pending"]
          );

      if (communityBullError) {
        console.error(
          "Community bull verification upgrade failed:",
          communityBullError
        );

        return errorResponse(
          "Your wallet was verified, but your community bull could not be upgraded.",
          500
        );
      }
    }
  }

  const {
    data: consumedNonce,
    error: consumeError
  } = await supabaseAdmin
    .from("claim_nonces")
    .update({
      used_at: verifiedAt
    })
    .eq("nonce", nonce)
    .is("used_at", null)
    .select("nonce")
    .maybeSingle();

  if (consumeError) {
    console.error("Nonce consumption failed:", consumeError);

    return errorResponse(
      "Your participation was saved, but the signing request could not be closed.",
      500
    );
  }

  if (!consumedNonce) {
    return errorResponse(
      "This signing request has already been used.",
      409
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Wallet verified. Your bull is now a verified holder.",
      countryCode,
      balanceRaw: balanceResult.balanceRaw.toString(),
      verifiedSlot: balanceResult.slot
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
