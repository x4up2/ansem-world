import { createClient } from "@supabase/supabase-js";

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is missing`);
  }

  return value;
}

const supabase = createClient(
  requireEnvironmentVariable("SUPABASE_URL"),
  requireEnvironmentVariable("SUPABASE_SECRET_KEY"),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

async function main() {
  const now = Date.now();

  const unusedCutoff = new Date(
    now - 24 * 60 * 60 * 1000
  ).toISOString();

  const usedCutoff = new Date(
    now - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  /*
   * Remove unused requests that expired more than
   * 24 hours ago.
   */
  const {
    data: deletedUnused,
    error: unusedError
  } = await supabase
    .from("claim_nonces")
    .delete()
    .is("used_at", null)
    .lt("expires_at", unusedCutoff)
    .select("nonce");

  if (unusedError) {
    throw new Error(
      `Unable to delete expired unused nonces: ${unusedError.message}`
    );
  }

  /*
   * Keep used nonces for seven days for short-term
   * troubleshooting, then remove them.
   */
  const {
    data: deletedUsed,
    error: usedError
  } = await supabase
    .from("claim_nonces")
    .delete()
    .not("used_at", "is", null)
    .lt("used_at", usedCutoff)
    .select("nonce");

  if (usedError) {
    throw new Error(
      `Unable to delete old used nonces: ${usedError.message}`
    );
  }

  console.log(
    `Expired unused nonces removed: ${deletedUnused?.length ?? 0}`
  );

  console.log(
    `Old used nonces removed: ${deletedUsed?.length ?? 0}`
  );

  console.log("✓ Nonce cleanup completed");
}

main().catch((error) => {
  console.error("Nonce cleanup failed:", error);
  process.exitCode = 1;
});
