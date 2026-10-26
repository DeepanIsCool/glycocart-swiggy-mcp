"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const KEY = "glycocart.session-refresh";

/**
 * Shown where a server-rendered page couldn't reach Swiggy. Tries one token
 * refresh through a route handler (which can write cookies), then re-renders.
 * Only if that fails does the person see `children`, the reconnect prompt.
 * Attempts are rate-limited so a page that fails for another reason can't loop.
 */
export function SessionRecovery({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let last = 0;
    try {
      last = Number(window.sessionStorage.getItem(KEY)) || 0;
    } catch {
      /* storage blocked: still try once per mount */
    }
    if (Date.now() - last < 60_000) {
      setFailed(true);
      return;
    }
    try {
      window.sessionStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    let cancelled = false;
    fetch("/api/auth/swiggy/refresh", { method: "POST" })
      .then((r) => r.json().catch(() => ({})))
      .then((d: { ok?: boolean }) => {
        if (cancelled) return;
        if (d?.ok) router.refresh();
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!failed) {
    return (
      <p className="text-sm text-ink-muted" role="status">
        Reconnecting to Swiggy…
      </p>
    );
  }
  return <>{children}</>;
}

/** Wraps `children` in SessionRecovery only when the failure was a dead session. */
export function RecoverIfExpired({ expired, children }: { expired: boolean; children: ReactNode }) {
  return expired ? <SessionRecovery>{children}</SessionRecovery> : <>{children}</>;
}
