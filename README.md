# ANSEM WORLD — v4

Visual and technical MVP for a privacy-first global community map for `$ANSEM` holders on Solana.

## What already works

- responsive dark landing page using the supplied Black Bull artwork;
- MapLibre world map with green points, glow, clustering and country popups;
- live-looking statistics and clear separation between total holders and mapped holders;
- `Claim your dot` flow with Phantom-compatible wallet connection and message signing;
- prototype API routes;
- Helius `getProgramAccountsV2` snapshot script with pagination and aggregation by wallet.

The map currently uses deterministic demonstration points. The interface explicitly labels them as demo data.

## Run locally

Requires Node.js 20.9 or later.

```bash
npm install
cp .env.example .env.local
npm run dev
```

On macOS, see `GUIDE_INSTALLATION_FR.md`; `START-PREVIEW.command` opens the static preview and `START-DEV.command` launches the full development app.

Open `http://localhost:3000`.

## Generate a real holder snapshot

1. Create a free Helius API key.
2. Put it in `.env.local`.
3. Run:

```bash
npm run snapshot:holders
```

The script writes `holders-snapshot.json`. It queries SPL Token accounts filtered by the ANSEM mint, paginates until the cursor is empty, then aggregates token accounts by wallet owner.

## Production work still required

1. Verify wallet signatures server-side with Ed25519.
2. Check the wallet's current ANSEM balance server-side before accepting a claim.
3. Add one-time nonces with expiry to prevent replay attacks.
4. Add PostgreSQL/Supabase tables for holders, claims and consent history.
5. Replace demo map points and statistics with database-backed data.
6. Run an incremental holder sync using `changedSinceSlot`, plus periodic full reconciliation.
7. Add rate limiting, abuse controls, deletion/export endpoints and a privacy page.
8. Deploy the Next.js frontend and a long-running worker separately.

## Suggested deployment

- Frontend/API: Vercel
- Database: Supabase Postgres
- Holder worker: Railway, Fly.io or Render
- Map tiles: OpenFreeMap dark style
- DNS/domain: Cloudflare

## Privacy model

- Country is voluntarily self-declared.
- No precise location is collected.
- Public map coordinates are randomly offset inside the selected country or region.
- Wallet addresses should not be exposed by the public API.
- A holder can delete their claim.

## Map reliability fix (v3)

The interactive map now uses a bundled, simplified Natural Earth country dataset instead of downloading a third-party basemap at runtime. This makes the MVP work even if a tile provider, DNS filter or content blocker is unavailable. The MapLibre error state is also shown directly in the page instead of silently leaving a blank panel.


## v4 map rendering fix

The MapLibre stylesheet is loaded before the project stylesheet, and the map container now has an explicit 100% width and height. This fixes a zero-height map container in the Next.js development build.


## v4.1 fix

The holder snapshot script now runs inside an async `main()` function so it works when `tsx` transpiles the script as CommonJS.
