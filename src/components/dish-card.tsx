"use client";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown, HelpCircle, Plus, Star, UtensilsCrossed, Flame } from "lucide-react";
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
  is_bestseller?: boolean;
  /** Entries from the person's own avoid list that this dish's name matches. */
  avoid_matches?: string[];
  /** Their stated diet rules this dish out. */
  diet_conflict?: boolean;
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

/** Keyboard focus is otherwise invisible: the base styles reset outlines. */
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

export function DishCard({
  item,
  rank,
  onAddToCart,
  showMenuLink = true
}: {
  item: ScoredItem;
  rank?: number;
  onAddToCart?: (item: ScoredItem) => void;
  /** Off on the restaurant page itself — you're already there. */
  showMenuLink?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const panelId = useId();
  const g = item.glycemic;
  const v = g ? VERDICT[g.verdict] : null;
  const outOfStock = item.in_stock === false;
  const showImage = item.image_url && !imgFailed;

  const canAdd = Boolean(onAddToCart && item.restaurant_id && !outOfStock);

  return (
    // Out of stock used to fade the whole card to 60%, which took the muted
    // text under AA. Only the photo dims now; the words say "out of stock".
    <div className="card-solid overflow-hidden">
      <div className="flex items-stretch">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          // Inset ring: the card clips overflow, so an outset one lost its edges.
          "flex-1 min-w-0 text-left p-3 flex items-start gap-3 rounded-2xl hover:bg-cream-deep/40 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-leaf"
        )}
      >
        {/* Thumbnail, with a tinted placeholder when Swiggy gives us nothing usable */}
        <span
          className={cn(
            "relative shrink-0 size-14 rounded-xl overflow-hidden bg-cream-deep flex items-center justify-center",
            outOfStock && "opacity-50 grayscale"
          )}
        >
          {showImage ? (
            <Image
              src={item.image_url!}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <UtensilsCrossed size={18} className="text-ink-muted" aria-hidden />
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

          {/* The verdict sits under the name rather than in its own column. As
              a third column it squeezed the name to ~108px on a 375px screen
              and every dish title wrapped to four lines.
              The peak used to be a bare "142": no unit, and nothing saying it
              was an estimate. Every glucose figure carries both. */}
          <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 mt-1">
            {g ? (
              <>
                <span className={cn("size-2 rounded-full shrink-0 self-center", v!.dot)} aria-hidden />
                <span className="text-xs text-ink-muted">est. peak</span>
                <span className="text-sm font-medium tabular-nums text-ink">
                  {g.predicted_peak_mg_dl}
                  <span className="text-xs font-normal text-ink-muted"> mg/dL</span>
                </span>
                <span className={cn("text-xs font-medium", v!.text)}>{v!.label}</span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                <HelpCircle size={13} aria-hidden /> Not scored
              </span>
            )}
          </span>

          {/* Price is what people scan for, so it reads in ink, not muted. */}
          <span className="block text-xs text-ink-muted mt-1">
            {typeof item.price === "number" && item.price > 0 ? (
              <span className="text-sm font-medium text-ink tabular-nums">
                {item.has_options && <span className="text-xs font-normal text-ink-muted">from </span>}
                {formatINR(item.price)}
              </span>
            ) : (
              "Price unavailable"
            )}
            {g && (
              <>
                {" · "}
                <span className="tabular-nums">{g.calories} kcal · {g.carbs_g}g carbs</span>
              </>
            )}
            {outOfStock && <span className="text-ember-text font-medium"> · Out of stock</span>}
          </span>

          {showMenuLink && item.restaurant_name && (
            <span className="flex items-center gap-1.5 mt-1 text-xs text-ink-muted">
              <span className="truncate max-w-[70%]">{item.restaurant_name}</span>
              {item.rating && (
                <span className="inline-flex items-center gap-0.5 shrink-0">
                  <Star size={10} className="fill-leaf-text text-leaf-text" aria-hidden />
                  {item.rating}
                </span>
              )}
            </span>
          )}

          {item.is_bestseller && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-swiggy-text">
              <Flame size={11} aria-hidden /> Bestseller here
            </span>
          )}
          {(item.avoid_matches?.length ?? 0) > 0 && (
            <span className="block mt-1.5 text-xs text-ember-text">
              On your avoid list: {item.avoid_matches!.join(", ").toLowerCase()}
            </span>
          )}
        </span>

        <ChevronDown
          size={15}
          aria-hidden
          className={cn(
            "text-ink-muted shrink-0 self-center transition-transform motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Adding was previously buried inside the expanded panel, so there was no
          way to tell a dish could be added without opening it first. */}
      {canAdd && (
        <button
          type="button"
          onClick={() => onAddToCart!(item)}
          aria-label={`Add ${item.name} to cart`}
          // 44x44: the old 36px target sat right next to the expand row and
          // was easy to miss on a phone.
          className={cn(
            "shrink-0 self-center mr-2 size-11 rounded-full bg-swiggy/15 border border-swiggy/40 text-swiggy-text flex items-center justify-center hover:bg-swiggy/25 active:scale-95 transition-all motion-reduce:transition-none",
            FOCUS
          )}
        >
          <Plus size={18} strokeWidth={2.5} aria-hidden />
        </button>
      )}
      </div>

      {open && (
        <div id={panelId} className="px-3 pb-3 border-t border-ink/8">
          {g ? (
            <>
              <div className="grid grid-cols-4 gap-2 my-3 text-center">
                <Stat label="kcal" value={g.calories} />
                <Stat label="carbs" value={`${g.carbs_g}g`} />
                <Stat label="protein" value={`${g.protein_g}g`} />
                <Stat label="fiber" value={`${g.fiber_g}g`} />
              </div>

              <div className="bg-cream rounded-xl p-3 mb-3">
                {/* 13px uppercase mono wrapped both halves onto two lines at
                    375px. This row is a label, not body copy. */}
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="mono text-ink-muted !text-[0.625rem]">estimated glucose</span>
                  <span className="mono text-ink !text-[0.6875rem] font-medium whitespace-nowrap">
                    peak {g.predicted_peak_mg_dl} mg/dL
                  </span>
                </div>
                <GlucoseChart curve={g.curve} peak={g.predicted_peak_mg_dl} height={96} />
              </div>

              <p className="text-xs text-ink-soft leading-relaxed">
                {/* The old markup rendered "basis , a category average": a JSX
                    space before the comma. */}
                {g.estimate_basis}
                {g.estimate_confidence === "archetype" && (
                  <span className="text-ink-muted">
                    , a category average, so it may differ from this kitchen&apos;s recipe.
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

          {canAdd && (
            <button
              type="button"
              onClick={() => onAddToCart!(item)}
              className={cn("btn-swiggy w-full mt-3 py-3 text-sm", FOCUS)}
            >
              <Plus size={15} aria-hidden /> Add to cart
            </button>
          )}
          {item.restaurant_id && showMenuLink && (
            <Link
              href={`/restaurant/${item.restaurant_id}`}
              className={cn("btn-ghost mt-2 -ml-3 min-h-11 text-sm", FOCUS)}
            >
              See the full menu, scored <ArrowRight size={13} aria-hidden />
            </Link>
          )}

          {onAddToCart && !item.restaurant_id && !outOfStock && (
            <p className="text-xs text-ink-muted mt-3">
              Swiggy didn&apos;t return a restaurant for this result, so it can&apos;t be added
              from here. Open the restaurant to add it.
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

/**
 * Placeholder in the exact footprint of a collapsed DishCard, shown while a
 * menu search is running. The shape of the answer is known, so a spinner would
 * waste the wait and the layout would jump when the cards land.
 */
export function DishCardSkeleton() {
  return (
    <div className="card-solid p-3 flex items-start gap-3" aria-hidden>
      <span className="shrink-0 size-14 rounded-xl bg-cream-deep motion-safe:animate-pulse" />
      <span className="flex-1 min-w-0 space-y-2 pt-0.5">
        <span className="block h-3.5 w-3/5 rounded bg-cream-deep motion-safe:animate-pulse" />
        <span className="block h-3 w-2/5 rounded bg-cream-deep motion-safe:animate-pulse" />
        <span className="block h-3 w-1/2 rounded bg-cream-deep motion-safe:animate-pulse" />
      </span>
      <span className="shrink-0 self-center size-11 rounded-full bg-cream-deep motion-safe:animate-pulse" />
    </div>
  );
}
