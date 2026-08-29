"use client";

import { CheckCircle2, AlertTriangle, Flame, HelpCircle } from "lucide-react";
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

const VERDICT_META = {
  excellent: { color: "text-leaf", bg: "bg-leaf-pale", label: "Excellent fit", Icon: CheckCircle2 },
  good: { color: "text-leaf", bg: "bg-leaf-pale/70", label: "Good fit", Icon: CheckCircle2 },
  moderate: { color: "text-ember-text", bg: "bg-ember-soft/30", label: "Moderate", Icon: AlertTriangle },
  poor: { color: "text-ember-text", bg: "bg-ember-soft/40", label: "Avoid", Icon: AlertTriangle }
} as const;

export function DishCard({ item, rank }: { item: ScoredItem; rank?: number }) {
  const g = item.glycemic;

  return (
    <div className="card p-5 animate-fade-up">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          {rank !== undefined && (
            <span className="mono text-ink-muted text-xs block mb-1">#{rank}</span>
          )}
          <h4 className="display text-xl leading-tight mb-1 break-words line-clamp-2">{item.name}</h4>
          <p className="text-ink-muted text-sm">
            {typeof item.price === "number" && item.price > 0
              ? formatINR(item.price)
              : "price unavailable"}
            {item.is_veg !== undefined && (
              <>
                {" · "}
                <span
                  className={cn(
                    "inline-block size-2.5 border align-middle mr-1",
                    item.is_veg ? "border-leaf-text" : "border-ember-text"
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      "block size-1.5 rounded-full m-[1px]",
                      item.is_veg ? "bg-leaf-text" : "bg-ember-text"
                    )}
                  />
                </span>
                {item.is_veg ? "veg" : "non-veg"}
              </>
            )}
          </p>
        </div>

        {g ? (
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0",
              VERDICT_META[g.verdict].bg,
              VERDICT_META[g.verdict].color
            )}
          >
            {(() => {
              const Icon = VERDICT_META[g.verdict].Icon;
              return <Icon size={12} />;
            })()}
            {VERDICT_META[g.verdict].label}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-ink/5 text-ink-muted shrink-0">
            <HelpCircle size={12} />
            Not scored
          </div>
        )}
      </div>

      {g ? (
        <>
          <div className="grid grid-cols-4 gap-2 mb-4 text-center">
            <Stat label="kcal" value={g.calories} />
            <Stat label="carbs" value={`${g.carbs_g}g`} />
            <Stat label="protein" value={`${g.protein_g}g`} />
            <Stat label="fiber" value={`${g.fiber_g}g`} />
          </div>

          <div className="bg-ink/[0.025] rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="mono text-ink-muted text-xs">estimated glucose · 3hr</span>
              <span className="mono text-ink text-[0.8125rem] font-medium">
                peak {g.predicted_peak_mg_dl} mg/dL
              </span>
            </div>
            <GlucoseChart curve={g.curve} peak={g.predicted_peak_mg_dl} height={100} />
          </div>

          <div className="flex gap-2 items-start text-xs text-ink-soft leading-relaxed">
            <Flame size={12} className="text-leaf mt-0.5 flex-shrink-0" />
            <span>
              {g.estimate_basis}
              {g.estimate_confidence === "archetype" && (
                <span className="text-ink-muted"> — category average, may differ from this kitchen's recipe</span>
              )}
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-ink/8 flex items-center justify-between">
            <span className="mono text-ink-muted text-xs">match score</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 rounded-full bg-ink/8 overflow-hidden">
                <div
                  className="h-full bg-leaf transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, g.match_score))}%` }}
                />
              </div>
              <span className="font-mono text-sm font-medium">{g.match_score}/100</span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-xs text-ink-muted leading-relaxed">
          We couldn&apos;t recognise this dish well enough to estimate its glucose impact,
          so we&apos;re not guessing. Treat it as unknown.
        </p>
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
