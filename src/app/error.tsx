"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Every tab page reads the profile from the database while rendering. When
 * that failed, the user got Next's bare "Application error" with no way back.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-dvh flex items-center justify-center px-5">
      <div className="card-solid p-6 max-w-sm w-full" role="alert">
        <h1 className="display text-2xl mb-2">Something didn&apos;t load</h1>
        <p className="text-sm text-ink-soft leading-relaxed">
          GlycoCart couldn&apos;t reach its database or Swiggy just now. Nothing in your Swiggy cart
          has changed.
        </p>
        {error.digest && <p className="text-xs text-ink-muted mt-3">Reference: {error.digest}</p>}
        <div className="flex flex-wrap gap-2 mt-5">
          <button type="button" onClick={reset} className="btn-primary min-h-11 text-sm">
            Try again
          </button>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center min-h-11 rounded-full border border-ink/10 px-4 text-sm font-medium text-ink-soft hover:text-ink"
          >
            Go to chat
          </Link>
        </div>
      </div>
    </main>
  );
}
