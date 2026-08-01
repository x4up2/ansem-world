import {
  createHmac,
  randomUUID
} from "node:crypto";

import {
  NextRequest,
  NextResponse
} from "next/server";

import { COUNTRY_CODE_SET } from "@/lib/countries";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "ansem_community_id";
const MAX_ADDITIONS_PER_IP_PER_DAY = 3;
const COUNTRY_HOURLY_REVIEW_THRESHOLD = 10;

type CommunityBullBody = {
  countryCode?: unknown;
  turnstileToken?: unknown;
};

type TurnstileResult = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

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

function getClientIp(
  request: NextRequest
): string {
  const forwardedFor =
    request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return (
      forwardedFor
        .split(",")[0]
        ?.trim() || "unknown"
    );
  }

  return (
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  );
}

function createHash(
  value: string,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(value)
    .digest("hex");
}

function getUtcDay(): string {
  return new Date()
    .toISOString()
    .slice(0, 10);
}

async function validateTurnstile(
  token: string,
  ip: string,
  secret: string
): Promise<TurnstileResult> {
  const formData = new FormData();

  formData.set("secret", secret);
  formData.set("response", token);
  formData.set("remoteip", ip);
  formData.set(
    "idempotency_key",
    randomUUID()
  );

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(
      `Turnstile returned HTTP ${response.status}`
    );
  }

  return (
    await response.json()
  ) as TurnstileResult;
}

export async function POST(
  request: NextRequest
) {
  const hmacSecret =
    process.env.COMMUNITY_BULL_HMAC_SECRET;

  const turnstileSecret =
    process.env.TURNSTILE_SECRET_KEY;

  if (!hmacSecret || !turnstileSecret) {
    console.error(
      "Community bull environment variables are missing."
    );

    return jsonError(
      "Community participation is temporarily unavailable.",
      503
    );
  }

  let body: CommunityBullBody;

  try {
    body =
      (await request.json()) as CommunityBullBody;
  } catch {
    return jsonError(
      "Invalid JSON body.",
      400
    );
  }

  const countryCode =
    typeof body.countryCode === "string"
      ? body.countryCode
          .trim()
          .toUpperCase()
      : "";

  const turnstileToken =
    typeof body.turnstileToken === "string"
      ? body.turnstileToken.trim()
      : "";

  if (!COUNTRY_CODE_SET.has(countryCode)) {
    return jsonError(
      "Unsupported country code.",
      400
    );
  }

  if (
    turnstileToken.length === 0 ||
    turnstileToken.length > 2048
  ) {
    return jsonError(
      "Please complete the human verification.",
      400
    );
  }

  const ip = getClientIp(request);

  let turnstileResult: TurnstileResult;

  try {
    turnstileResult =
      await validateTurnstile(
        turnstileToken,
        ip,
        turnstileSecret
      );
  } catch (error) {
    console.error(
      "Turnstile validation failed:",
      error
    );

    return jsonError(
      "Human verification is temporarily unavailable.",
      502
    );
  }

  if (!turnstileResult.success) {
    console.warn(
      "Turnstile rejected community bull:",
      turnstileResult["error-codes"]
    );

    return jsonError(
      "Human verification failed. Please try again.",
      403
    );
  }

  const existingBrowserId =
    request.cookies.get(COOKIE_NAME)?.value;

  const browserId =
    existingBrowserId &&
    /^[0-9a-f-]{36}$/i.test(
      existingBrowserId
    )
      ? existingBrowserId
      : randomUUID();

  const browserHash = createHash(
    `browser:${browserId}`,
    hmacSecret
  );

  const ipDayHash = createHash(
    `ip:${getUtcDay()}:${ip}`,
    hmacSecret
  );

  const {
    data: existingBull,
    error: existingBullError
  } = await supabaseAdmin
    .from("community_bulls")
    .select(
      "id, country_code, status"
    )
    .eq("browser_hash", browserHash)
    .neq("status", "removed")
    .maybeSingle();

  if (existingBullError) {
    console.error(
      "Community bull browser lookup failed:",
      existingBullError
    );

    return jsonError(
      "Unable to check your existing participation.",
      500
    );
  }

  if (existingBull) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This browser has already added a bull.",
        countryCode:
          existingBull.country_code,
        status:
          existingBull.status
      },
      {
        status: 409,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const {
    count: ipDayCount,
    error: ipCountError
  } = await supabaseAdmin
    .from("community_bulls")
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("ip_day_hash", ipDayHash)
    .in("status", [
      "active",
      "pending",
      "verified"
    ]);

  if (ipCountError) {
    console.error(
      "Community bull IP limit lookup failed:",
      ipCountError
    );

    return jsonError(
      "Unable to check the participation limit.",
      500
    );
  }

  if (
    (ipDayCount ?? 0) >=
    MAX_ADDITIONS_PER_IP_PER_DAY
  ) {
    return jsonError(
      "The daily participation limit has been reached for this network.",
      429
    );
  }

  const oneHourAgo = new Date(
    Date.now() - 60 * 60 * 1000
  ).toISOString();

  const {
    count: recentCountryCount,
    error: recentCountryError
  } = await supabaseAdmin
    .from("community_bulls")
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("country_code", countryCode)
    .in("status", [
      "active",
      "pending"
    ])
    .gte("created_at", oneHourAgo);

  if (recentCountryError) {
    console.error(
      "Recent country activity lookup failed:",
      recentCountryError
    );

    return jsonError(
      "Unable to check recent map activity.",
      500
    );
  }

  const status =
    (recentCountryCount ?? 0) >=
    COUNTRY_HOURLY_REVIEW_THRESHOLD
      ? "pending"
      : "active";

  const now = new Date().toISOString();

  const {
    data: insertedBull,
    error: insertError
  } = await supabaseAdmin
    .from("community_bulls")
    .insert({
      country_code: countryCode,
      browser_hash: browserHash,
      ip_day_hash: ipDayHash,
      status,
      updated_at: now
    })
    .select(
      "id, country_code, status, created_at"
    )
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return jsonError(
        "This browser has already added a bull.",
        409
      );
    }

    console.error(
      "Community bull insertion failed:",
      insertError
    );

    return jsonError(
      "Your bull could not be added.",
      500
    );
  }

  const response = NextResponse.json(
    {
      ok: true,
      countryCode:
        insertedBull.country_code,
      status:
        insertedBull.status,
      message:
        status === "active"
          ? "Your community bull has been added."
          : "Your bull has been received and is awaiting review."
    },
    {
      status: 201,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );

  if (!existingBrowserId) {
    response.cookies.set(
      COOKIE_NAME,
      browserId,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge:
          60 * 60 * 24 * 365
      }
    );
  }

  return response;
}
