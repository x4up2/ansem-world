import {
  createHash,
  createHmac,
  randomBytes
} from "node:crypto";

import {
  NextRequest,
  NextResponse
} from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "ansem_community_id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TOKEN_RE = /^[0-9a-f]{64}$/i;

const TOKEN_LIFETIME_MS =
  10 * 60 * 1000;

function jsonError(
  error: string,
  status: number
) {
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

function hashBrowserId(
  browserId: string,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(`browser:${browserId}`)
    .digest("hex");
}

function hashToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function POST(
  request: NextRequest
) {
  const hmacSecret =
    process.env.COMMUNITY_BULL_HMAC_SECRET;

  if (!hmacSecret) {
    return jsonError(
      "Mobile verification is temporarily unavailable.",
      503
    );
  }

  const browserId =
    request.cookies.get(COOKIE_NAME)?.value;

  if (
    !browserId ||
    !UUID_RE.test(browserId)
  ) {
    return jsonError(
      "Your community bull could not be identified in this browser.",
      404
    );
  }

  const browserHash = hashBrowserId(
    browserId,
    hmacSecret
  );

  const {
    data: communityBull,
    error: bullError
  } = await supabaseAdmin
    .from("community_bulls")
    .select("id, country_code, status")
    .eq("browser_hash", browserHash)
    .neq("status", "removed")
    .maybeSingle();

  if (bullError) {
    console.error(
      "Mobile handoff bull lookup failed:",
      bullError
    );

    return jsonError(
      "Unable to prepare mobile verification.",
      500
    );
  }

  if (!communityBull) {
    return jsonError(
      "No community bull was found for this browser.",
      404
    );
  }

  if (communityBull.status === "verified") {
    return jsonError(
      "Your bull is already verified.",
      409
    );
  }

  if (
    communityBull.status !== "active" &&
    communityBull.status !== "pending"
  ) {
    return jsonError(
      "This community bull cannot currently be verified.",
      409
    );
  }

  const { error: cleanupError } =
    await supabaseAdmin
      .from(
        "community_bull_verification_tokens"
      )
      .delete()
      .eq(
        "community_bull_id",
        communityBull.id
      )
      .is("used_at", null);

  if (cleanupError) {
    console.error(
      "Previous mobile handoff cleanup failed:",
      cleanupError
    );

    return jsonError(
      "Unable to prepare mobile verification.",
      500
    );
  }

  const token =
    randomBytes(32).toString("hex");

  const tokenHash = hashToken(token);

  const expiresAt = new Date(
    Date.now() + TOKEN_LIFETIME_MS
  ).toISOString();

  const { error: insertError } =
    await supabaseAdmin
      .from(
        "community_bull_verification_tokens"
      )
      .insert({
        token_hash: tokenHash,
        community_bull_id:
          communityBull.id,
        expires_at: expiresAt
      });

  if (insertError) {
    console.error(
      "Mobile handoff token creation failed:",
      insertError
    );

    return jsonError(
      "Unable to prepare mobile verification.",
      500
    );
  }

  return NextResponse.json(
    {
      ok: true,
      token,
      countryCode:
        communityBull.country_code,
      expiresAt
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function GET(
  request: NextRequest
) {
  const token =
    request.nextUrl.searchParams
      .get("token")
      ?.trim() ?? "";

  if (!TOKEN_RE.test(token)) {
    return jsonError(
      "Invalid mobile verification link.",
      400
    );
  }

  const tokenHash = hashToken(token);

  const {
    data: tokenRow,
    error: tokenError
  } = await supabaseAdmin
    .from(
      "community_bull_verification_tokens"
    )
    .select(
      "community_bull_id, expires_at, used_at"
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (tokenError) {
    console.error(
      "Mobile handoff token lookup failed:",
      tokenError
    );

    return jsonError(
      "Unable to validate the mobile verification link.",
      500
    );
  }

  if (!tokenRow) {
    return jsonError(
      "This mobile verification link was not found.",
      404
    );
  }

  if (tokenRow.used_at) {
    return jsonError(
      "This mobile verification link has already been used.",
      409
    );
  }

  if (
    new Date(tokenRow.expires_at).getTime() <=
    Date.now()
  ) {
    return jsonError(
      "This mobile verification link has expired. Please return to your original browser and try again.",
      410
    );
  }

  const {
    data: communityBull,
    error: bullError
  } = await supabaseAdmin
    .from("community_bulls")
    .select("id, country_code, status")
    .eq(
      "id",
      tokenRow.community_bull_id
    )
    .maybeSingle();

  if (bullError) {
    console.error(
      "Mobile handoff bull validation failed:",
      bullError
    );

    return jsonError(
      "Unable to validate your community bull.",
      500
    );
  }

  if (!communityBull) {
    return jsonError(
      "The associated community bull no longer exists.",
      404
    );
  }

  if (
    communityBull.status !== "active" &&
    communityBull.status !== "pending"
  ) {
    return jsonError(
      communityBull.status === "verified"
        ? "Your bull is already verified."
        : "This community bull cannot currently be verified.",
      409
    );
  }

  return NextResponse.json(
    {
      ok: true,
      countryCode:
        communityBull.country_code,
      status:
        communityBull.status,
      expiresAt:
        tokenRow.expires_at
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
