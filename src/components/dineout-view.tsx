"use client";

import { useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { DineoutCard, type DineoutRestaurantView } from "./restaurant-card";
import { cn } from "@/lib/utils";

/**
 * Eating out is the hardest case for someone tracking glucose: no menu, no
 * macros, and a table booked hours in advance. Dineout gives cuisines but no
 * dishes, so the value here is the search plus the per-restaurant ordering
 * brief scored against this user's own model.
 */
const VIBES = ["Rooftop", "Buffet", "North Indian", "Chinese", "Cafe", "Seafood", "Outdoor seating"];

export function DineoutView({ addressLabel }: { addressLabel?: string }) {
  const [query, setQuery] = useState("");
  /** The term the results on screen belong to, which the input may have moved on from. */
  const [searched, setSearched] = useState<string | null>(null);
  const [results, setResults] = useState<DineoutRestaurantView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What actually fixes the failure: a retry won't help a missing address or a dead session.
  const [fix, setFix] = useState<"address" | "reconnect" | null>(null);
  // Tapping a second vibe before the first answered let the slower, older
  // response overwrite the newer one. Only the latest request may land.
  const requestId = useRef(0);

  async function search(q: string) {
    const term = q.trim();
    if (!term) return;
    const mine = ++requestId.current;
    setQuery(term);
    setSearched(term);
    setLoading(true);
    setError(null);
    setFix(null);
    try {
      const res = await fetch(`/api/dineout?q=${encodeURIComponent(term)}`);
      const data = await res.json().catch(() => null);
      if (mine !== requestId.current) return;
      if (!res.ok) setFix(data?.needsAddress ? "address" : data?.reconnect ? "reconnect" : null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Dineout search failed.");
      setResults(Array.isArray(data?.restaurants) ? data.restaurants : []);
    } catch (err) {
      if (mine !== requestId.current) return;
      setError(err instanceof Error ? err.message : "Dineout search failed.");
      setResults(null);
    } finally {
      if (mine === requestId.current) setLoading(false);
    }
  }

  const count = results?.length ?? 0;

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
        className="flex items-center gap-2 mb-3"
      >
        <label className="flex-1 min-w-0 flex items-center gap-2 bg-cream-warm border border-ink/10 rounded-full px-4 min-h-12 focus-within:border-leaf focus-within:ring-2 focus-within:ring-leaf/30 transition-colors">
          <Search size={15} className="text-ink-muted shrink-0" aria-hidden />
          <span className="sr-only">Search Dineout restaurants</span>
          <input
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cuisine, area or vibe"
            className="bg-transparent border-none outline-none text-base md:text-sm flex-1 min-w-0 placeholder:text-ink-muted"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          aria-label="Search"
          className={cn("btn-primary size-12 justify-center px-0 disabled:opacity-50", "focus-ring")}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Search size={16} aria-hidden />
          )}
        </button>
      </form>

      {/* One scrolling row, as food apps do it. Wrapped, seven chips took three
          rows of a phone screen before the first result. */}
      <div
        role="group"
        aria-label="Suggested searches"
        className="-mx-5 md:-mx-10 mb-4 flex gap-2 overflow-x-auto px-5 md:px-10 pb-1 scrollbar-none"
      >
        {VIBES.map((v) => {
          const current = searched === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => search(v)}
              aria-pressed={current}
              className={cn(
                "shrink-0 min-h-11 whitespace-nowrap rounded-full border px-4 text-sm transition-colors motion-reduce:transition-none",
                "focus-ring",
                current
                  ? "bg-ink text-cream border-ink font-medium"
                  : "bg-cream-warm border-ink/10 text-ink-soft hover:bg-cream-deep"
              )}
            >
              {v}
            </button>
          );
        })}
      </div>

      {addressLabel && (
        <p className="text-xs text-ink-muted mb-4 line-clamp-1">Searching near {addressLabel}</p>
      )}

      {/* Screen readers hear the outcome of a search; sighted users see it. */}
      <p role="status" aria-live="polite" className="sr-only">
        {loading
          ? "Searching Dineout"
          : error
            ? ""
            : results
              ? `${count} ${count === 1 ? "place" : "places"} for ${searched ?? ""}`
              : ""}
      </p>

      {error && !loading && (
        <div className="card-solid p-5 mb-4" role="alert">
          <p className="font-medium mb-1">Search didn&apos;t go through</p>
          <p className="text-sm text-ink-muted leading-relaxed">{error}</p>
          {fix === "address" && (
            <a href="/settings" className={cn("btn-primary mt-4 min-h-11 text-sm", "focus-ring")}>
              Pick an address in Settings
            </a>
          )}
          {fix === "reconnect" && (
            <a href="/api/auth/swiggy/login" className={cn("btn-primary mt-4 min-h-11 text-sm", "focus-ring")}>
              Reconnect Swiggy
            </a>
          )}
          {searched && !fix && (
            <button
              type="button"
              onClick={() => search(searched)}
              className={cn(
                "mt-4 inline-flex items-center justify-center min-h-11 rounded-full border border-ink/10 bg-cream px-4 text-sm font-medium text-ink-soft hover:text-ink hover:bg-cream-deep/60 transition-colors",
                "focus-ring"
              )}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Two round-trips to Swiggy, searching then enriching, so the wait is
          real and the page must not just go blank. Old results are hidden
          meanwhile, so they never sit under the new search term. */}
      {loading && (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-solid p-3 flex items-start gap-3">
              <span className="size-16 rounded-xl bg-cream-deep shrink-0 animate-pulse motion-reduce:animate-none" />
              <span className="flex-1 space-y-2 pt-1">
                <span className="block h-3.5 w-2/3 rounded skeleton" />
                <span className="block h-3 w-1/2 rounded skeleton" />
                <span className="block h-3 w-1/3 rounded skeleton" />
              </span>
            </div>
          ))}
        </div>
      )}

      {results === null && !loading && !error && (
        <div className="card-solid p-6">
          <p className="font-medium mb-1">Find a table you can actually eat at</p>
          <p className="text-sm text-ink-muted leading-relaxed">
            Search a cuisine or a vibe. Each result opens an ordering brief: which typical dishes
            of that cuisine sit easiest with your profile, and which spike hardest.
          </p>
        </div>
      )}

      {!loading && results?.length === 0 && (
        <div className="card-solid p-5">
          <p className="font-medium mb-1">Nothing matched &ldquo;{searched}&rdquo;</p>
          <p className="text-sm text-ink-muted leading-relaxed">
            Try a broader term, a cuisine rather than a dish, or one of the suggestions above.
          </p>
        </div>
      )}

      {!loading && results && results.length > 0 && (
        <>
          <p className="text-xs text-ink-muted mb-2 tabular-nums">
            {count} {count === 1 ? "place" : "places"} for &ldquo;{searched}&rdquo;
          </p>
          <ul className="space-y-2">
            {results.map((r) => (
              <li key={r.id}>
                <DineoutCard r={r} />
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted leading-relaxed mt-5">
            Briefs are estimates for typical dishes of each cuisine, not this kitchen&apos;s recipes.
            GlycoCart doesn&apos;t book tables. Swiggy&apos;s live booking API exposes no cancel, so
            you book in the Swiggy app and keep control of the reservation.
          </p>
        </>
      )}
    </div>
  );
}
