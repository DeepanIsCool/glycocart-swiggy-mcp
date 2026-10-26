"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * App-bar back control. Goes back in history when the menu was opened from
 * inside the app (a chat result, usually), so the conversation keeps its
 * scroll position; falls back to Chat for a menu opened from a shared link.
 */
export function BackButton({ fallback = "/chat" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => {
        // document.referrer is only set by a full page load, so an empty one
        // after client-side navigation still means "came from inside the app".
        // An outside referrer means back would leave GlycoCart.
        let outside = false;
        try {
          outside = document.referrer !== "" && new URL(document.referrer).origin !== window.location.origin;
        } catch {
          outside = false;
        }
        if (window.history.length > 1 && !outside) router.back();
        else router.push(fallback);
      }}
      className="app-bar-action focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf"
    >
      <ChevronLeft size={22} aria-hidden />
    </button>
  );
}
