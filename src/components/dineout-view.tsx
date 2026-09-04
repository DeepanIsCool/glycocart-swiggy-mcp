"use client";

import { useState } from "react";
import { Search, Loader2, UtensilsCrossed } from "lucide-react";
import { DineoutCard, type DineoutRestaurantView } from "./restaurant-card";

/**
 * Eating out is the hardest case for someone tracking glucose: no menu, no
 * macros, and a table booked hours in advance. Dineout gives cuisines but no
 * dishes, so the value here is the search plus the per-restaurant ordering
 * brief scored against this user's own model.
 */
const VIBES = ["Rooftop", "Buffet", "North Indian", "Chinese", "Cafe", "Seafood", "Outdoor seating"];

export function DineoutView({ addressLabel }: { addressLabel?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DineoutRestaurantView[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(q: string) {
    const term = q.trim();
    if (!term) return;
    setQuery(term);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dineout?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Dineout search failed.");
      setResults(data.restaurants ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dineout search failed.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
        className="flex items-center gap-2 mb-3"
      >
        <div className="flex-1 flex items-center gap-2 bg-cream-warm border border-ink/10 rounded-full px-4 py-3 focus-within:border-leaf transition-colors">
          <Search size={15} className="text-ink-muted shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cuisine, place or vibe: 'rooftop', 'Italian'"
            className="bg-transparent border-none outline-none text-sm flex-1 min-w-0"
          />
        </div>
        <button type="submit" disabled={loading || !query.trim()} className="btn-primary disabled:opacity-50">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        </button>
      </form>

      <div className="flex flex-wrap gap-2 mb-5">
        {VIBES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => search(v)}
            className="text-xs px-3 py-1.5 rounded-full bg-cream-warm border border-ink/10 hover:bg-cream-deep transition-colors"
          >
            {v}
          </button>
        ))}
      </div>

      {addressLabel && (
        <p className="text-xs text-ink-muted mb-4 line-clamp-1">Searching near {addressLabel}</p>
      )}

      {error && <p className="text-sm text-ember-text mb-4">{error}</p>}

      {/* Two round-trips to Swiggy — searching then enriching — so the wait is
          real and the page must not just go blank. */}
      {loading && (
        <div className="space-y-2" aria-live="polite">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card-solid p-3 flex items-start gap-3">
              <span className="size-16 rounded-xl bg-cream-deep shrink-0 animate-pulse" />
              <span className="flex-1 space-y-2 pt-1">
                <span className="block h-3.5 w-2/3 rounded bg-cream-deep animate-pulse" />
                <span className="block h-3 w-1/2 rounded bg-cream-deep animate-pulse" />
                <span className="block h-3 w-1/3 rounded bg-cream-deep animate-pulse" />
              </span>
            </div>
          ))}
        </div>
      )}

      {results === null && !loading && !error && (
        <div className="card-solid p-8 text-center">
          <UtensilsCrossed size={26} className="mx-auto text-ink-muted mb-3" />
          <p className="font-medium mb-1">Find a table you can actually eat at</p>
          <p className="text-sm text-ink-muted leading-relaxed">
            Search a cuisine or a vibe. Each result opens an ordering brief: which typical dishes
            of that cuisine sit easiest with your profile, and which spike hardest.
          </p>
        </div>
      )}

      {results?.length === 0 && (
        <p className="text-sm text-ink-muted">
          Nothing matched &ldquo;{query}&rdquo;. Try a broader term, a cuisine rather than a dish.
        </p>
      )}

      <div className="space-y-2">
        {results?.map((r) => (
          <DineoutCard key={r.id} r={r} />
        ))}
      </div>

      {results && results.length > 0 && (
        <p className="text-xs text-ink-muted leading-relaxed mt-5">
          Briefs are estimates for typical dishes of each cuisine, not this kitchen&apos;s recipes.
          GlycoCart doesn&apos;t book tables. Swiggy&apos;s live booking API exposes no cancel, so
          you book in the Swiggy app and keep control of the reservation.
        </p>
      )}
    </div>
  );
}
