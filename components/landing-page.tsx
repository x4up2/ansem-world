"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ANSEM_MINT } from "@/lib/config";
import { ClaimModal } from "./claim-modal";
import { LiveMap } from "./live-map";

type Stats = {
  totalHolders: number;
  mappedHolders: number;
  countries: number;
  last24h: number;
  generatedAt?: string | null;
  liveUpdatedAt?: string | null;
  mode?: string;
};

const initialStats: Stats = {
  totalHolders: 0,
  mappedHolders: 0,
  countries: 0,
  last24h: 0,
  generatedAt: null,
  liveUpdatedAt: null,
  mode: "loading"
};

export function LandingPage() {
  const [claimOpen, setClaimOpen] = useState(false);
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    let active = true;

    async function loadStats() {
      try {
        const response = await fetch(
          "/api/stats",
          {
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error(
            `Stats request failed: ${response.status}`
          );
        }

        const data =
          (await response.json()) as Stats;

        if (active) {
          setStats(data);
        }
      } catch (error) {
        console.error(
          "Unable to refresh community statistics:",
          error
        );
      }
    }

    void loadStats();

    const timer = window.setInterval(
      loadStats,
      10_000
    );

    const handleClaimUpdated = () => {
      void loadStats();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadStats();
      }
    };

    window.addEventListener(
      "ansem-claim-updated",
      handleClaimUpdated
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      active = false;
      window.clearInterval(timer);

      window.removeEventListener(
        "ansem-claim-updated",
        handleClaimUpdated
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="ANSEM WORLD home">
          <Image src="/ansem-bull.png" alt="Black Bull" width={42} height={42} priority />
          <span>ANSEM <strong>WORLD</strong></span>
        </a>

        <div className="header-contract" aria-label="Official ANSEM token address">
          <span>OFFICIAL $ANSEM TOKEN ADDRESS</span>
          <code>{ANSEM_MINT}</code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(ANSEM_MINT)}
            aria-label="Copy the official ANSEM token address"
          >
            COPY
          </button>
        </div>

        <nav>
          <a href="#map">MAP</a>
          <a href="#how">HOW IT WORKS</a>
          <a href={`https://solscan.io/token/${ANSEM_MINT}`} target="_blank" rel="noreferrer">TOKEN ↗</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid" />
        <div className="hero-copy">
          <p className="eyebrow"><span className="live-dot" /> LIVE ON SOLANA</p>
          <h1><span>THE GLOBAL</span> $ANSEM HERD</h1>
          <p className="hero-subtitle">Track the herd. Put your country on the map.</p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => setClaimOpen(true)}>JOIN THE HERD</button>
            <a className="secondary-button" href="#map">EXPLORE THE MAP ↓</a>
          </div>
          <p className="signature-reassurance">
            <strong>MESSAGE SIGNATURE ONLY</strong>
            <span>— no transaction or token approval.</span>
          </p>

          <p className="community-map-explanation">
            Solana can identify $ANSEM holders, but not their country.
            The community map can only grow when holders voluntarily
            verify their wallet and select their country.
          </p>

        </div>
        <div className="hero-bull" aria-hidden="true">
          <div className="bull-aura" />
          <Image src="/ansem-bull.png" alt="" width={420} height={420} priority />
        </div>
      </section>

      <section className="map-section" id="map">
        <div className="section-heading">
          <div><p className="eyebrow">GLOBAL COMMUNITY</p><h2>One country. One light.</h2></div>
          <p>Each light groups verified $ANSEM holders by country. The larger the light, the larger the local herd.</p>
        </div>
        <LiveMap />
      </section>


      <section className="stats-grid" aria-label="Community statistics">
        <Stat
          value={stats.totalHolders.toLocaleString("en-US")}
          label="TOTAL HOLDERS"
          note={formatSnapshotNote(stats.generatedAt)}
        />
        <Stat
          value={stats.mappedHolders.toLocaleString("en-US")}
          label="MAPPED BULLS"
          note="auto-refresh · 10s"
        />
        <Stat
          value={String(stats.countries)}
          label="COUNTRIES"
          note="verified communities"
        />
        <Stat
          value={stats.last24h.toLocaleString("en-US")}
          label="LAST 24 HOURS"
          note="new verified bulls"
        />
      </section>

      <section className="how-section" id="how">
        <div className="section-heading compact"><div><p className="eyebrow">PRIVACY-FIRST</p><h2>One signature. Zero transactions.</h2></div></div>
        <div className="steps">
          <Step number="01" title="Connect" text="Use Phantom Wallet. More Solana wallets may be supported later. The site never sees your private key or seed phrase." />
          <Step number="02" title="Prove" text="Sign a human-readable message and let the server verify that the wallet holds $ANSEM." />
          <Step number="03" title="Join" text="Choose a country. Your verified wallet increases that country’s light; no precise location is requested or displayed." />
        </div>
      </section>

      <section
        className="transparency-section"
        aria-labelledby="project-transparency-title"
      >
        <div className="trust-panel">
          <div className="transparency-copy">
            <p
              className="transparency-heading"
              id="project-transparency-title"
            >
              PROJECT TRANSPARENCY
            </p>

            <p className="project-disclaimer">
              Independent community project — not affiliated with or endorsed by the $ANSEM team.
            </p>
          </div>

          <a
            className="github-source-link"
            href="https://github.com/x4up2/ansem-world"
            target="_blank"
            rel="noreferrer"
            aria-label="Review the ANSEM WORLD public source code on GitHub"
          >
            PUBLIC SOURCE CODE — REVIEW ON GITHUB ↗
          </a>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand"><Image src="/ansem-bull.png" alt="" width={34} height={34} /><span>ANSEM <strong>WORLD</strong></span></div>
        <p>Community concept. Not financial advice. Geographic claims are voluntary and self-declared.</p>
      </footer>

      <ClaimModal open={claimOpen} onClose={() => setClaimOpen(false)} />
    </main>
  );
}


function formatSnapshotNote(
  generatedAt?: string | null
) {
  if (!generatedAt) {
    return "latest Solana snapshot";
  }

  const date = new Date(generatedAt);

  if (Number.isNaN(date.getTime())) {
    return "latest Solana snapshot";
  }

  const formatted =
    new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC"
    }).format(date);

  return `snapshot · ${formatted} UTC`;
}

function Stat({ value, label, note }: { value: string; label: string; note: string }) {
  return <article className="stat-card"><strong>{value}</strong><span>{label}</span><small>{note}</small></article>;
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <article className="step"><span>{number}</span><h3>{title}</h3><p>{text}</p></article>;
}
