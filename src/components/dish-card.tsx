"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { GlucoseChart } from "./glucose-chart";
import { formatINR, cn } from "@/lib/utils";

/** A real Swiggy menu item, scored server-side against the signed-in user's profile. */
export interface ScoredItem {
  id?: string;
  name: string;
  price?: number;
  is_veg?: boolean;
  glycemic: {
    predicted_peak_mg_dl: number;
    match_score: number;
    verdict: "excellent" | "good" | "moderate" | "poor";
    calories: number;
    carbs_g: number;
    protein_g: number;
    fiber_g: number;
    estimate_confidence: "matched" | "archetype";
    estimate_basis: string;
    curve: { t: number; mgDl: number }[];
  } | null;
}

const VERDICT = {
  excellent: { dot: "bg-leaf", text: "text-leaf-text", label: "Excellent" },
  good: { dot: "bg-leaf-soft", text: "text-leaf-text", label: "Good" },
  moderate: { dot: "bg-ember-soft", text: "text-ember-text", label: "Moderate" },
  poor: { dot: "bg-ember", text: "text-ember-text", label: "Avoid" }
} as const;

/**
 * Compact by default: one scannable row per dish so several options can be
 * compared at a glance, with the curve and macros one tap away. Rendering a
 * full 100px chart per dish turned five results into an unreadable wall.
 */
export function DishCard({ item, rank }: { item: ScoredItem; rank?: number }) {
  const [open, setOpen] = useState(false);
  const g = item.glycemic;
  const v = g ? VERDICT[g.verdict] : null;

  return (
    <div className="card-solid overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-cream-deep/40 transition-colors"
      >
        {item.is_veg !== undefined && (
          <span
            className={cn(
              "shrink-0 inline-flex items-center justify-center size-3.5 border",
              item.is_veg ? "border-leaf-text" : "border-ember-text"
            )}
            aria-label={item.is_veg ? "vegetarian" : "non-vegetarian"}
          >
            <span className={cn("size-1.5 rounded-full", item.is_veg ? "bg-leaf-text" : "bg-ember-text")} />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-snug break-words line-clamp-2">
            {rank !== undefined && <span className="text-ink-muted mr-1.5">{rank}.</span>}
            {item.name}
          </span>
          <span className="block text-xs text-ink-muted mt-0.5">
            {typeof item.price === "number" && item.price > 0 ? formatINR(item.price) : "price unavailable"}
            {g && (
              <>
                {" · "}
                {g.calories} kcal · {g.carbs_g}g carbs
              </>
            )}
          </span>
        </span>

        {g ? (
          <span className="shrink-0 text-right">
            <span className="flex items-center gap-1.5 justify-end">
              <span className={cn("size-2 rounded-full", v!.dot)} />
              <span className="text-sm font-medium tabular-nums">{g.predicted_peak_mg_dl}</span>
            </span>
            <span className={cn("block text-xs", v!.text)}>{v!.label}</span>
          </span>
        ) : (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs text-ink-muted">
            <HelpCircle size={13} /> not scored
          </span>
        )}

        <ChevronDown
          size={15}
          className={cn("shrink-0 text-ink-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-ink/8">
          {g ? (
            <>
              <div className="grid grid-cols-4 gap-2 my-3 text-center">
                <Stat label="kcal" value={g.calories} />
                <Stat label="carbs" value={`${g.carbs_g}g`} />
                <Stat label="protein" value={`${g.protein_g}g`} />
                <Stat label="fiber" value={`${g.fiber_g}g`} />
              </div>

              <div className="bg-cream rounded-xl p-3 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="mono text-ink-muted text-xs">estimated glucose · 3hr</span>
                  <span className="mono text-ink text-[0.8125rem] font-medium">
                    peak {g.predicted_peak_mg_dl} mg/dL
                  </span>
                </div>
                <GlucoseChart curve={g.curve} peak={g.predicted_peak_mg_dl} height={96} />
              </div>

              <p className="text-xs text-ink-soft leading-relaxed">
                {g.estimate_basis}
                {g.estimate_confidence === "archetype" && (
                  <span className="text-ink-muted">
                    {" "}
                    — a category average, so it may differ from this kitchen&apos;s recipe.
                  </span>
                )}
              </p>
            </>
          ) : (
            <p className="text-xs text-ink-muted leading-relaxed pt-3">
              We couldn&apos;t recognise this dish well enough to estimate its glucose impact,
              so we&apos;re not guessing. Treat it as unknown.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cream py-2 rounded-lg">
      <div className="text-sm font-medium">{value}</div>
      <div className="mono text-ink-muted text-xs">{label}</div>
    </div>
  );
}
