# ANSEM WORLD

ANSEM WORLD is an open-source community map for `$ANSEM` holders on Solana.

The blockchain can identify wallets holding `$ANSEM`, but it cannot determine their country. Holders can therefore voluntarily verify their wallet and select their country to help build the map.

**Live site:** https://www.ansemworld.com/

## Security

ANSEM WORLD does not create or request any blockchain transaction.

- No token approval
- No spending permission
- No transfer
- No fee
- No seed phrase or private key request
- No wallet download or browser extension installation

Phantom is only asked to sign a one-time, human-readable message. The signature proves that the visitor controls the public wallet address.

The signature cannot authorize a transaction, move funds or grant access to tokens.

The signed message includes:

- the public wallet address;
- the selected country;
- a unique nonce;
- an issue time;
- an expiration time.

The server then verifies the signature and checks whether the wallet currently holds `$ANSEM`.

## Privacy

The country is self-declared.

ANSEM WORLD does not attempt to infer nationality or location from:

- an IP address;
- GPS data;
- wallet activity;
- blockchain transactions.

The application stores:

- the public Solana wallet address;
- the selected country;
- timestamps and technical data required to verify and manage the claim.

The public map exposes only aggregated country totals. It does not publish the list of wallet addresses associated with each country.

## How it works

1. Select a country.
2. Connect Phantom.
3. Read and sign the verification message.
4. The server verifies wallet ownership.
5. The server checks the `$ANSEM` balance.
6. The country total is updated.

One wallet can have one active country claim.

## Token

**Official `$ANSEM` mint address:**

```text
9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump
```

The application uses the Solana Token-2022 program.

## Holder statistics

The global holder count is generated from Solana blockchain data through Helius.

A GitHub Actions workflow updates the holder snapshot every hour. Country claim statistics are stored in Supabase and updated independently.

## Technology

- Next.js
- TypeScript
- React
- MapLibre GL
- Solana
- Phantom
- Helius
- Supabase
- Vercel
- GitHub Actions

## Local development

Requirements:

- Node.js 22 or later
- npm
- a Helius API key
- a Supabase project

Clone and install the project:

```bash
git clone https://github.com/x4up2/ansem-world.git
cd ansem-world
npm install
cp .env.example .env.local
```

Complete `.env.local` with your own credentials:

```env
HELIUS_API_KEY=
SUPABASE_URL=
SUPABASE_SECRET_KEY=

NEXT_PUBLIC_ANSEM_MINT=9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump
NEXT_PUBLIC_MAP_STYLE=https://tiles.openfreemap.org/styles/dark
```

Start the development server:

```bash
npm run dev
```

Run a production build:

```bash
npm run build
```

Update the holder snapshot manually:

```bash
npm run snapshot:holders
```

## Environment-variable security

`HELIUS_API_KEY` and `SUPABASE_SECRET_KEY` are server-only credentials and must never be committed to Git.

Variables beginning with `NEXT_PUBLIC_` are intentionally included in the browser bundle and must not contain secrets.

The real `.env.local` file is excluded by `.gitignore`.

## Responsible disclosure

Please do not publicly disclose sensitive security findings before they have been reviewed.

To report a vulnerability, open a GitHub issue containing only non-sensitive information or contact the repository owner privately.

## Disclaimer

This is an independent community project. It is not an official wallet, exchange or custody service.

The project is open source, but it has not undergone a formal third-party security audit.

Always read wallet messages carefully before signing them.

## License

No license has currently been selected. Unless a license is added, the source code remains publicly viewable but is not automatically licensed for reuse.
