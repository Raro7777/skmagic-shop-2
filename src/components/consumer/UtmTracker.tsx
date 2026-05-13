"use client";

import { useEffect } from "react";

const STORAGE_KEY = "rk_utm_v1";

export type UtmSnapshot = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  referrer?: string;
  landingPath?: string;
  deviceType?: string;
  capturedAt?: string;
};

/**
 * Captures UTM params from the URL on first visit and persists them to
 * sessionStorage. Subsequent navigation within the site keeps the same
 * attribution. ConsultForm reads from `getUtm()` on submit.
 *
 * Mount once per consumer page (PartnerSiteShell / product detail / category etc.)
 */
export default function UtmTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const params = url.searchParams;

    const incoming: UtmSnapshot = {};
    const get = (k: string) => params.get(k)?.slice(0, 256) ?? undefined;

    incoming.source   = get("utm_source");
    incoming.medium   = get("utm_medium");
    incoming.campaign = get("utm_campaign");
    incoming.content  = get("utm_content");
    incoming.term     = get("utm_term");

    const hasUtm = Boolean(incoming.source || incoming.medium || incoming.campaign);

    // If new UTM in URL, overwrite (last touch). If no new UTM, keep stored.
    if (hasUtm) {
      const ref = document.referrer && !document.referrer.startsWith(window.location.origin)
        ? document.referrer.slice(0, 256)
        : undefined;
      incoming.referrer = ref;
      incoming.landingPath = url.pathname;
      incoming.deviceType = guessDevice();
      incoming.capturedAt = new Date().toISOString();
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(incoming));
      } catch {
        // ignore storage errors (private mode)
      }
    } else if (!sessionStorage.getItem(STORAGE_KEY)) {
      // First visit with no UTM — still record referrer + landing path
      const ref = document.referrer && !document.referrer.startsWith(window.location.origin)
        ? document.referrer.slice(0, 256)
        : undefined;
      const fallback: UtmSnapshot = {
        referrer: ref,
        landingPath: url.pathname,
        deviceType: guessDevice(),
        capturedAt: new Date().toISOString(),
      };
      if (ref) {
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
        } catch {
          /* */
        }
      }
    }
  }, []);

  return null;
}

export function getUtm(): UtmSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UtmSnapshot) : null;
  } catch {
    return null;
  }
}

function guessDevice(): "mobile" | "tablet" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobile|iphone|android.*mobile/.test(ua)) return "mobile";
  return "desktop";
}
