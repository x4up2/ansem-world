import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

type HolderSnapshotRow = {
  holder_count: number;
  token_account_count: number | null;
  slot: number | null;
  generated_at: string;
  source: string;
};

export type LatestHolderSnapshot = {
  holderCount: number;
  tokenAccountCount: number | null;
  slot: number | null;
  generatedAt: string;
  source: string;
};

export async function getLatestHolderSnapshot():
  Promise<LatestHolderSnapshot> {
  const { data, error } = await supabaseAdmin
    .from("holder_snapshots")
    .select(
      "holder_count, token_account_count, slot, generated_at, source"
    )
    .order("generated_at", {
      ascending: false
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to load latest holder snapshot: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "No holder snapshot is available in Supabase."
    );
  }

  const row = data as HolderSnapshotRow;

  if (
    !Number.isInteger(row.holder_count) ||
    row.holder_count < 0
  ) {
    throw new Error(
      "The latest holder snapshot contains an invalid holder count."
    );
  }

  return {
    holderCount: row.holder_count,
    tokenAccountCount:
      row.token_account_count,
    slot: row.slot,
    generatedAt: row.generated_at,
    source: row.source
  };
}
