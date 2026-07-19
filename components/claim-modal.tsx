"use client";

import {
  useEffect,
  useMemo,
  useState
} from "react";

import { COUNTRIES } from "@/lib/countries";

type SolanaPublicKey = {
  toString(): string;
};

type SolanaProvider = {
  isPhantom?: boolean;
  publicKey?: SolanaPublicKey;

  connect(): Promise<{
    publicKey: SolanaPublicKey;
  }>;

  signMessage(
    message: Uint8Array,
    display?: "utf8" | "hex"
  ): Promise<{
    signature: Uint8Array;
  }>;
};

declare global {
  interface Window {
    phantom?: {
      solana?: SolanaProvider;
    };

    solana?: SolanaProvider;
  }
}

type NonceResponse = {
  ok?: boolean;
  error?: string;
  nonce?: string;
  message?: string;
};

type ClaimResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export function ClaimModal({
  open,
  onClose
}: {
  open: boolean;
  onClose(): void;
}) {
  const [country, setCountry] = useState("FR");
  const [wallet, setWallet] =
    useState<string | null>(null);

  const [status, setStatus] =
    useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const selectedCountry = useMemo(
    () =>
      COUNTRIES.find(
        ({ code }) => code === country
      )?.name,
    [country]
  );

  useEffect(() => {
    if (open) {
      setWallet(null);
      setStatus(null);
      setBusy(false);
      setSuccess(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function connectAndSign() {
    setBusy(true);
    setSuccess(false);
    setStatus("Connecting to Phantom…");

    try {
      const provider =
        window.phantom?.solana ??
        window.solana;

      if (!provider) {
        throw new Error(
          "Phantom was not detected. Install Phantom and reload the page."
        );
      }

      if (typeof provider.signMessage !== "function") {
        throw new Error(
          "This wallet does not support message signing."
        );
      }

      const connection = await provider.connect();
      const address =
        connection.publicKey.toString();

      setWallet(address);
      setStatus(
        "Creating a secure signing request…"
      );

      const nonceResponse = await fetch(
        "/api/claim/nonce",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            wallet: address,
            countryCode: country
          })
        }
      );

      const nonceBody =
        (await nonceResponse.json()) as NonceResponse;

      if (
        !nonceResponse.ok ||
        !nonceBody.ok ||
        !nonceBody.nonce ||
        !nonceBody.message
      ) {
        throw new Error(
          nonceBody.error ??
            "Unable to create the signing request."
        );
      }

      setStatus(
        "Approve the message in Phantom. No transaction will be created."
      );

      const signed =
        await provider.signMessage(
          new TextEncoder().encode(
            nonceBody.message
          ),
          "utf8"
        );

      setStatus(
        "Verifying your wallet and $ANSEM balance…"
      );

      const claimResponse = await fetch(
        "/api/claim",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            nonce: nonceBody.nonce,
            wallet: address,
            countryCode: country,
            message: nonceBody.message,
            signature: Array.from(
              signed.signature
            )
          })
        }
      );

      const claimBody =
        (await claimResponse.json()) as ClaimResponse;

      if (!claimResponse.ok || !claimBody.ok) {
        throw new Error(
          claimBody.error ??
            claimBody.message ??
            "The claim could not be verified."
        );
      }

      setSuccess(true);

      window.dispatchEvent(
        new Event("ansem-claim-updated")
      );

      setStatus(
        claimBody.message ??
          `You are now counted in ${selectedCountry}.`
      );
    } catch (error) {
      setSuccess(false);

      setStatus(
        error instanceof Error
          ? error.message
          : "Wallet connection or signature failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={busy ? undefined : onClose}
    >
      <section
        className="claim-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-title"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
          disabled={busy}
        >
          ×
        </button>

        <p className="eyebrow">
          JOIN THE GLOBAL HERD
        </p>

        <h2 id="claim-title">
          Join your country’s herd
        </h2>

        <p className="modal-copy">
          Choose your country, connect your wallet
          and sign a one-time message. No
          transaction, no fee and no exact location.
        </p>

        <label
          className="field-label"
          htmlFor="country"
        >
          Country of residence
        </label>

        <select
          id="country"
          value={country}
          disabled={busy || success}
          onChange={(event) =>
            setCountry(event.target.value)
          }
        >
          {COUNTRIES.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>

        <div className="privacy-note">
          <strong>Privacy by design</strong>

          <span>
            Your public point will be randomly
            positioned inside {selectedCountry}.
            No precise location is requested or displayed.
          </span>
        </div>

        <button
          className="primary-button full"
          type="button"
          onClick={connectAndSign}
          disabled={busy || success}
        >
          {success
            ? "YOU’RE COUNTED"
            : busy
              ? "PLEASE WAIT…"
              : wallet
                ? `SIGN WITH ${wallet.slice(0, 4)}…${wallet.slice(-4)}`
                : "CONNECT & VERIFY"}
        </button>

        {status && (
          <p
            className="claim-status"
            role="status"
            aria-live="polite"
          >
            {status}
          </p>
        )}
      </section>
    </div>
  );
}
