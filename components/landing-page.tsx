"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ANSEM_MINT } from "@/lib/config";
import { ClaimModal } from "./claim-modal";
import { CommunityBullModal } from "./community-bull-modal";
import { LiveMap } from "./live-map";

type Stats = {
  totalHolders: number;
  mappedHolders: number;
  verifiedHolders: number;
  communityBulls: number;
  countries: number;
  last24h: number;
  generatedAt?: string | null;
  liveUpdatedAt?: string | null;
  mode?: string;
};

const initialStats: Stats = {
  totalHolders: 0,
  mappedHolders: 0,
  verifiedHolders: 0,
  communityBulls: 0,
  countries: 0,
  last24h: 0,
  generatedAt: null,
  liveUpdatedAt: null,
  mode: "loading"
};

export function LandingPage() {
  const [claimOpen, setClaimOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [verifyCountry, setVerifyCountry] =
    useState<string | null>(null);
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    const url = new URL(window.location.href);

    if (url.searchParams.get("join") === "1") {
      setClaimOpen(true);
      url.searchParams.delete("join");

      const cleanUrl =
        `${url.pathname}${url.search}${url.hash}`;

      window.history.replaceState({}, "", cleanUrl);
    }
  }, []);

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
          <h1><span>THE GLOBAL</span> $ANSEM HERD</h1>
          <p className="hero-subtitle">
          Help build the global $ANSEM community map.
          <br />
          Add your bull to your country. Bigger dots mean bigger herds.
        </p>
<p className="community-map-explanation">
            Anyone can add one community bull to a country.
            $ANSEM holders can optionally verify their bull with Phantom.
          </p>

        </div>
        <div className="hero-bull" aria-hidden="true">
          <div className="bull-aura" />
          <Image src="/ansem-bull.png" alt="" width={420} height={420} priority />
        </div>
      </section>

      <section className="map-section" id="map">
<div className="map-stats-layout">
          <aside
            className="map-cta-panel"
            aria-label="Join the ANSEM community map"
          >
            <div className="map-cta-main">
              <div className="map-cta-copy">
                <span>ADD YOUR BULL TO THE MAP</span>
                <h3>Join the global herd.</h3>
                <p>
                  Choose your country and add one community bull.
                  No wallet connection required.
                </p>
              </div>

              <button
                className="primary-button map-cta-button"
                type="button"
                onClick={() => setCommunityOpen(true)}
              >
                JOIN THE HERD
              </button>

              <p className="map-cta-reassurance">
                <strong>NO WALLET NEEDED</strong>
                <span>Phantom verification is optional.</span>
              </p>
            </div>

            <div className="map-cta-footer">
              <div className="map-cta-divider" aria-hidden="true" />
              <p className="map-cta-map-note">
                Each light groups bulls by country.
                The larger the light, the larger the local herd.
              </p>
            </div>
          </aside>

          <div className="map-column">
            <LiveMap />
          </div>

          <aside
            className="stats-grid stats-sidebar"
            id="stats"
            aria-label="Community statistics"
          >
            <Stat
              value={stats.totalHolders.toLocaleString("en-US")}
              label="TOTAL HOLDERS"
              note={formatSnapshotNote(stats.generatedAt)}
            />
            <Stat
              value={stats.mappedHolders.toLocaleString("en-US")}
              label="MAPPED BULLS"
              note="includes verified holders"
            />
            <Stat
              value={stats.verifiedHolders.toLocaleString("en-US")}
              label="VERIFIED BULLS"
              note="verified with Phantom"
            />
            <Stat
              value={String(stats.countries)}
              label="COUNTRIES"
              note="active local herds"
            />
          </aside>
        </div>
      </section>

      <section className="how-section" id="how">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">
              LOW FRICTION, OPTIONAL PROOF
            </p>
            <h2>Add first. Verify if you choose.</h2>
          </div>
        </div>

        <div className="steps">
          <Step
            number="01"
            title="Add"
            text="Choose your country and add one community bull. No wallet connection is required."
          />
          <Step
            number="02"
            title="Verify"
            text="Optional: connect Phantom and sign a readable message to prove that you hold $ANSEM. No transaction or token approval."
          />
          <Step
            number="03"
            title="Grow"
            text="Bigger dots mean bigger local herds. Verified holders are counted separately."
          />
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
        <p>Community concept. Not financial advice. Country selections are voluntary and self-declared; verified bulls are wallet-checked.</p>
      </footer>

      <CommunityBullModal
        open={communityOpen}
        onClose={() => setCommunityOpen(false)}
        onVerify={(countryCode) => {
          setVerifyCountry(countryCode);
          setCommunityOpen(false);
          setClaimOpen(true);
        }}
      />

      <ClaimModal
        open={claimOpen}
        initialCountry={verifyCountry ?? undefined}
        onClose={() => {
          setClaimOpen(false);
          setVerifyCountry(null);
        }}
      />
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
