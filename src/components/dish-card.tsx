"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown, HelpCircle, Star, UtensilsCrossed } from "lucide-react";
import { GlucoseChart } from "./glucose-chart";
import { formatINR, cn } from "@/lib/utils";

/** A real Swiggy menu item, scored server-side against the signed-in user's profile. */
export interface ScoredItem {
  id?: string;
  name: string;
  price?: number;
  is_veg?: boolean;
  image_url?: string | null;
  restaurant_id?: string;
  restaurant_name?: string;
  rating?: string | number;
  total_ratings?: string;
  in_stock?: boolean;
  has_options?: boolean;
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

export function DishCard({
  item,
  rank,
  onAddToCart
}: {
  item: ScoredItem;
  rank?: number;
  onAddToCart?: (item: ScoredItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const g = item.glycemic;
  const v = g ? VERDICT[g.verdict] : null;
  const outOfStock = item.in_stock === false;
  const showImage = item.image_url && !imgFailed;

  return (
    <div className={cn("card-solid overflow-hidden", outOfStock && "opacity-60")}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full text-left p-3 flex items-start gap-3 hover:bg-cream-deep/40 transition-colors"
      >
        {/* Thumbnail, with a tinted placeholder when Swiggy gives us nothing usable */}
        <span className="relative shrink-0 size-16 rounded-xl overflow-hidden bg-cream-deep flex items-center justify-center">
          {showImage ? (
            <Image
              src={item.image_url!}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <UtensilsCrossed size={20} className="text-ink-muted" aria-hidden />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-1.5">
            {item.is_veg !== undefined && (
              <span
                className={cn(
                  "mt-0.5 shrink-0 inline-flex items-center justify-center size-3.5 border",
                  item.is_veg ? "border-leaf-text" : "border-ember-text"
                )}
                aria-label={item.is_veg ? "vegetarian" : "non-vegetarian"}
              >
                <span
                  className={cn("size-1.5 rounded-full", item.is_veg ? "bg-leaf-text" : "bg-ember-text")}
                />
              </span>
            )}
            <span className="block text-sm font-medium leading-snug break-words line-clamp-2">
              {rank !== undefined && <span className="text-ink-muted mr-1">{rank}.</span>}
              {item.name}
            </span>
          </span>

          {item.restaurant_name && (
            <span className="flex items-center gap-1.5 mt-1 text-xs text-ink-muted">
              <span className="truncate max-w-[60%]">{item.restaurant_name}</span>
              {item.rating && (
                <span className="inline-flex items-center gap-0.5 shrink-0">
                  <Star size={10} className="fill-leaf-text text-leaf-text" />
                  {item.rating}
                </span>
              )}
            </span>
          )}

          <span className="block text-xs text-ink-muted mt-1">
            {typeof item.price === "number" && item.price > 0 ? (
              <>
                {item.has_options && "from "}
                {formatINR(item.price)}
              </>
            ) : (
              "price unavailable"
            )}
            {g && (
              <>
                {" · "}
                {g.calories} kcal · {g.carbs_g}g carbs
              </>
            )}
            {outOfStock && <span className="text-ember-text"> · out of stock</span>}
          </span>
        </span>

        <span className="shrink-0 flex items-center gap-2">
          {g ? (
            <span className="text-right">
              <span className="flex items-center gap-1.5 justify-end">
                <span className={cn("size-2 rounded-full", v!.dot)} />
                <span className="text-sm font-medium tabular-nums">{g.predicted_peak_mg_dl}</span>
              </span>
              <span className={cn("block text-xs", v!.text)}>{v!.label}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <HelpCircle size={13} /> not scored
            </span>
          )}
          <ChevronDown
            size={15}
            className={cn("text-ink-muted transition-transform", open && "rotate-180")}
          />
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-ink/8">
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

          {onAddToCart && item.restaurant_id && !outOfStock && (
            <button
              type="button"
              onClick={() => onAddToCart(item)}
              className="btn-swiggy w-full mt-3 py-2.5 text-sm"
            >
              Add to cart
            </button>
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
