import { writeFile } from "node:fs/promises";

const TOKEN_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const MINT =
  process.env.NEXT_PUBLIC_ANSEM_MINT ??
  "9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump";
const API_KEY = process.env.HELIUS_API_KEY;

type ParsedTokenAccount = {
  pubkey: string;
  account: {
    data: {
      parsed?: {
        info?: {
          mint?: string;
          owner?: string;
          tokenAmount?: {
            amount?: string;
            decimals?: number;
            uiAmountString?: string;
          };
        };
      };
    };
  };
};

type HeliusPage = {
  jsonrpc: "2.0";
  result?: {
    context?: { slot: number };
    value?: {
      accounts: ParsedTokenAccount[];
      paginationKey: string | null;
    };
    accounts?: ParsedTokenAccount[];
    paginationKey?: string | null;
  };
  error?: { code: number; message: string };
};

async function fetchPage(paginationKey?: string): Promise<HeliusPage> {
  const response = await fetch(
    `https://mainnet.helius-rpc.com/?api-key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "ansem-holder-snapshot",
        method: "getProgramAccountsV2",
        params: [
          TOKEN_PROGRAM,
          {
            commitment: "confirmed",
            encoding: "jsonParsed",
            withContext: true,
            limit: 5000,
            filters: [
              { memcmp: { offset: 0, bytes: MINT } },
            ],
            ...(paginationKey ? { paginationKey } : {}),
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Helius HTTP ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as HeliusPage;
}

async function main(): Promise<void> {
  if (!API_KEY) {
    throw new Error(
      "HELIUS_API_KEY is required. Add it to the .env.local file.",
    );
  }

  const balances = new Map<string, bigint>();
  let cursor: string | undefined;
  let pages = 0;
  let slot = 0;

  while (true) {
    const page = await fetchPage(cursor);
    if (page.error) {
      throw new Error(`Helius ${page.error.code}: ${page.error.message}`);
    }

    const result = page.result;
    const value = result?.value ?? result;
    const accounts = value?.accounts ?? [];
    const paginationKey = value?.paginationKey ?? null;
    slot = result?.context?.slot ?? slot;

    for (const item of accounts) {
      const info = item.account.data.parsed?.info;
      if (!info?.owner || info.mint !== MINT) continue;

      const raw = BigInt(info.tokenAmount?.amount ?? "0");
      if (raw <= 0n) continue;

      balances.set(info.owner, (balances.get(info.owner) ?? 0n) + raw);
    }

    pages += 1;
    console.log(
      `page=${pages} accounts=${accounts.length} unique_wallets=${balances.size}`,
    );

    if (!paginationKey || accounts.length === 0) break;
    cursor = paginationKey;
  }

  const holders = [...balances.entries()]
    .filter(([, balance]) => balance > 0n)
    .sort((a, b) => (a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1))
    .map(([wallet, rawBalance]) => ({
      wallet,
      rawBalance: rawBalance.toString(),
    }));

  await writeFile(
    "holders-snapshot.json",
    JSON.stringify(
      {
        mint: MINT,
        slot,
        generatedAt: new Date().toISOString(),
        holderCount: holders.length,
        holders,
      },
      null,
      2,
    ),
  );

  console.log(
    `Saved holders-snapshot.json with ${holders.length} non-zero wallets.`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Snapshot failed: ${message}`);
  process.exitCode = 1;
});
