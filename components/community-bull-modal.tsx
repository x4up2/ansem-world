"use client";

import Script from "next/script";
import type { FormEvent } from "react";
import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { COUNTRIES } from "@/lib/countries";

type TurnstileOptions = {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact" | "flexible";
  appearance?: "always" | "execute" | "interaction-only";
  language?: string;
  callback(token: string): void;
  "expired-callback"(): void;
  "error-callback"(code: string): boolean;
  "refresh-expired"?: "auto" | "manual" | "never";
};

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: TurnstileOptions
  ): string;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

type CommunityBullResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  countryCode?: string;
  status?: string;
  existing?: boolean;
  canVerify?: boolean;
};

const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function CommunityBullModal({
  open,
  onClose,
  onVerify
}: {
  open: boolean;
  onClose(): void;
  onVerify(countryCode: string): void;
}) {
  const [country, setCountry] = useState("FR");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [existingStatus, setExistingStatus] =
    useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] =
    useState(false);
  const [status, setStatus] =
    useState<string | null>(null);

  const [turnstileReady, setTurnstileReady] =
    useState(false);

  const [turnstileToken, setTurnstileToken] =
    useState("");

  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const widgetIdRef =
    useRef<string | null>(null);

  const selectedCountry = useMemo(
    () =>
      COUNTRIES.find(
        ({ code }) => code === country
      )?.name ?? country,
    [country]
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    setBusy(false);
    setSuccess(false);
    setExistingStatus(null);
    setStatus(null);
    setTurnstileToken("");
    setCheckingExisting(true);

    void (async () => {
      try {
        const response = await fetch(
          "/api/community-bulls",
          {
            method: "GET",
            cache: "no-store"
          }
        );

        const body =
          (await response.json()) as CommunityBullResponse;

        if (
          cancelled ||
          !response.ok ||
          !body.existing ||
          !body.countryCode
        ) {
          return;
        }

        setCountry(body.countryCode);
        setSuccess(true);
        setExistingStatus(
          body.status ?? "active"
        );

        setStatus(
          body.status === "verified"
            ? "Your bull is already verified."
            : "Your community bull is already on the map. You can now verify it with Phantom."
        );
      } catch (error) {
        console.error(
          "Unable to restore community bull:",
          error
        );
      } finally {
        if (!cancelled) {
          setCheckingExisting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (
      !open ||
      checkingExisting ||
      success ||
      !turnstileReady ||
      !TURNSTILE_SITE_KEY ||
      !containerRef.current ||
      !window.turnstile ||
      widgetIdRef.current
    ) {
      return;
    }

    const widgetId = window.turnstile.render(
      containerRef.current,
      {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "dark",
        size: "flexible",
        appearance: "always",
        language: "en",
        "refresh-expired": "auto",

        callback(token) {
          setTurnstileToken(token);
          setStatus(null);
        },

        "expired-callback"() {
          setTurnstileToken("");
          setStatus(
            "Human verification expired. Please try again."
          );
        },

        "error-callback"(code) {
          console.error(
            "Turnstile client error:",
            code
          );

          setTurnstileToken("");
          setStatus(
            "Human verification could not start. Please refresh and try again."
          );

          return true;
        }
      }
    );

    widgetIdRef.current = widgetId;

    return () => {
      if (
        widgetIdRef.current &&
        window.turnstile
      ) {
        try {
          window.turnstile.remove(
            widgetIdRef.current
          );
        } catch {
          // The widget may already have been removed.
        }
      }

      widgetIdRef.current = null;
    };
  }, [
    open,
    turnstileReady,
    checkingExisting,
    success
  ]);

  if (!open) {
    return null;
  }

  async function addCommunityBull(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!turnstileToken) {
      setStatus(
        "Please complete the human verification."
      );
      return;
    }

    setBusy(true);
    setStatus("Adding your bull…");

    try {
      const response = await fetch(
        "/api/community-bulls",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            countryCode: country,
            turnstileToken
          })
        }
      );

      const body =
        (await response.json()) as CommunityBullResponse;

      if (!response.ok || !body.ok) {
        throw new Error(
          body.error ??
            "Your bull could not be added."
        );
      }

      setSuccess(true);
      setExistingStatus(
        body.status ?? "active"
      );
      setStatus(
        body.message ??
          `Your bull has been added to ${selectedCountry}.`
      );

      window.dispatchEvent(
        new Event("ansem-claim-updated")
      );
    } catch (error) {
      setSuccess(false);
      setStatus(
        error instanceof Error
          ? error.message
          : "Your bull could not be added."
      );

      setTurnstileToken("");

      if (
        widgetIdRef.current &&
        window.turnstile
      ) {
        window.turnstile.reset(
          widgetIdRef.current
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Script
        id="ansem-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setTurnstileReady(true)}
      />

      <div
        className="modal-backdrop"
        role="presentation"
        onMouseDown={busy ? undefined : onClose}
      >
        <section
          className="claim-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="community-bull-title"
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

          <h2 id="community-bull-title">
            Add your bull
          </h2>

          <p className="modal-copy">
            Choose your country and add one community
            bull. No wallet connection is required.
          </p>

          <form onSubmit={addCommunityBull}>
            <label
              className="field-label"
              htmlFor="community-country"
            >
              Country of residence
            </label>

            <select
              id="community-country"
              value={country}
              disabled={
                busy ||
                success ||
                checkingExisting
              }
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
              <strong>
                One community bull per browser
              </strong>
              <span>
                Only your selected country is displayed.
                No precise location is requested.
              </span>
            </div>

            {!success && (
              <div className="turnstile-shell">
                {checkingExisting ? (
                  <span>
                    Checking for an existing bull…
                  </span>
                ) : !TURNSTILE_SITE_KEY ? (
                  <span>
                    Human verification is unavailable.
                  </span>
                ) : (
                  <div ref={containerRef} />
                )}
              </div>
            )}

            <button
              className="primary-button full"
              type="submit"
              disabled={
                busy ||
                success ||
                checkingExisting ||
                !turnstileToken ||
                !TURNSTILE_SITE_KEY
              }
            >
              {success
                ? "YOUR BULL IS ON THE MAP"
                : busy
                  ? "ADDING YOUR BULL…"
                  : "ADD MY BULL"}
            </button>
          </form>

          {status && (
            <p
              className="claim-status"
              role="status"
              aria-live="polite"
            >
              {status}
            </p>
          )}

          {success &&
            existingStatus !== "verified" && (
            <div className="community-verify-panel">
              <strong>
                Want to make it a verified bull?
              </strong>

              <span>
                Optional: prove that you hold $ANSEM
                through a readable Phantom message
                signature. No transaction or token
                approval.
              </span>

              <button
                className="secondary-button full"
                type="button"
                onClick={() => onVerify(country)}
              >
                VERIFY WITH PHANTOM
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
