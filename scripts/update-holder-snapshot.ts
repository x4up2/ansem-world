import bs58 from "bs58";
import { createClient } from "@supabase/supabase-js";

const ANSEM_MINT =
  "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump";

const TOKEN_2022_PROGRAM =
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const PAGE_LIMIT = 10_000;
const MAX_RETRIES = 4;

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is missing`);
  }

  return value;
}

const heliusApiKey =
  requireEnvironmentVariable("HELIUS_API_KEY");

const supabaseUrl =
  requireEnvironmentVariable("SUPABASE_URL");

const supabaseSecretKey =
  requireEnvironmentVariable("SUPABASE_SECRET_KEY");

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

type ProgramAccount = {
  account?: {
    data?: [string, string];
  };
};

type RpcResult = {
  context?: {
    slot?: number;
  };

  value?: {
    accounts?: ProgramAccount[];
    paginationKey?: string | null;
  };

  accounts?: ProgramAccount[];
  paginationKey?: string | null;
};

type RpcPayload = {
  result?: RpcResult;

  error?: {
    code?: number;
    message?: string;
  };
};

function sleep(milliseconds: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );
}

async function fetchPage(
  paginationKey?: string
): Promise<{
  accounts: ProgramAccount[];
  paginationKey: string | null;
  slot: number | null;
}> {
  const url =
    `https://mainnet.helius-rpc.com/?api-key=` +
    encodeURIComponent(heliusApiKey);

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt += 1
  ) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      45_000
    );

    try {
      const response = await fetch(url, {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        signal: controller.signal,

        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "ansem-holder-snapshot",
          method: "getProgramAccountsV2",

          params: [
            TOKEN_2022_PROGRAM,
            {
              commitment: "finalized",
              encoding: "base64",
              withContext: true,
              limit: PAGE_LIMIT,

              /*
               * Token account layout:
               * bytes 0–31  = mint
               * bytes 32–63 = owner
               * bytes 64–71 = raw amount
               *
               * The mint is filtered by Helius, so only
               * owner + amount are downloaded.
               */
              filters: [
                {
                  memcmp: {
                    offset: 0,
                    bytes: ANSEM_MINT
                  }
                }
              ],

              dataSlice: {
                offset: 32,
                length: 40
              },

              ...(paginationKey
                ? { paginationKey }
                : {})
            }
          ]
        })
      });

      if (
        response.status === 429 ||
        response.status >= 500
      ) {
        throw new Error(
          `Temporary Helius HTTP error ${response.status}`
        );
      }

      if (!response.ok) {
        throw new Error(
          `Helius HTTP error ${response.status}`
        );
      }

      const payload =
        (await response.json()) as RpcPayload;

      if (payload.error) {
        throw new Error(
          payload.error.message ??
            `Helius RPC error ${
              payload.error.code ?? "unknown"
            }`
        );
      }

      if (!payload.result) {
        throw new Error(
          "Helius returned no result"
        );
      }

      const result = payload.result;

      return {
        accounts:
          result.value?.accounts ??
          result.accounts ??
          [],

        paginationKey:
          result.value?.paginationKey ??
          result.paginationKey ??
          null,

        slot:
          result.context?.slot ?? null
      };
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }

      const delay = 1_000 * 2 ** (attempt - 1);

      console.warn(
        `Page request failed — retrying in ${
          delay / 1000
        }s`
      );

      await sleep(delay);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Unreachable retry state");
}

async function main() {
  console.log("Starting $ANSEM holder snapshot…");

  const balancesByOwner =
    new Map<string, bigint>();

  let paginationKey: string | undefined;
  let tokenAccountCount = 0;
  let latestSlot: number | null = null;
  let pageNumber = 0;

  do {
    pageNumber += 1;

    const page =
      await fetchPage(paginationKey);

    for (const programAccount of page.accounts) {
      const encodedData =
        programAccount.account?.data?.[0];

      if (!encodedData) {
        continue;
      }

      const data = Buffer.from(
        encodedData,
        "base64"
      );

      if (data.length < 40) {
        throw new Error(
          `Unexpected sliced account length: ${data.length}`
        );
      }

      const owner = bs58.encode(
        data.subarray(0, 32)
      );

      const amount =
        data.readBigUInt64LE(32);

      const previousBalance =
        balancesByOwner.get(owner) ?? 0n;

      balancesByOwner.set(
        owner,
        previousBalance + amount
      );

      tokenAccountCount += 1;
    }

    if (
      page.slot !== null &&
      (
        latestSlot === null ||
        page.slot > latestSlot
      )
    ) {
      latestSlot = page.slot;
    }

    paginationKey =
      page.paginationKey ?? undefined;

    console.log(
      `Page ${pageNumber}: ` +
      `${page.accounts.length.toLocaleString()} accounts · ` +
      `${tokenAccountCount.toLocaleString()} total`
    );

    if (pageNumber > 1_000) {
      throw new Error(
        "Pagination safety limit reached"
      );
    }
  } while (paginationKey);

  let holderCount = 0;

  for (const balance of balancesByOwner.values()) {
    if (balance > 0n) {
      holderCount += 1;
    }
  }

  const generatedAt =
    new Date().toISOString();

  console.log("");
  console.log(
    `Unique holders: ${holderCount.toLocaleString()}`
  );

  console.log(
    `Token accounts: ${tokenAccountCount.toLocaleString()}`
  );

  console.log(
    `Slot: ${latestSlot ?? "unknown"}`
  );

  const { data, error } = await supabase
    .from("holder_snapshots")
    .insert({
      holder_count: holderCount,
      token_account_count: tokenAccountCount,
      slot: latestSlot,
      generated_at: generatedAt,
      source: "helius-getProgramAccountsV2"
    })
    .select(
      "id, holder_count, token_account_count, slot, generated_at"
    )
    .single();

  if (error) {
    throw new Error(
      `Supabase insert failed: ${error.message}`
    );
  }

  console.log("");
  console.log("✓ Snapshot saved to Supabase");
  console.log(data);
}

main().catch((error) => {
  console.error("");
  console.error("Snapshot failed:", error);
  process.exitCode = 1;
});
