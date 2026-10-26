"use client";

import { Fragment, useId, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, Store, ChevronRight, ChevronDown, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

/** A delivery restaurant from search_restaurants. */
export interface ScoredRestaurant {
  id?: string;
  name: string;
  cuisines?: string[];
  rating?: number;
  total_ratings?: string;
  cost_for_two?: string;
  area?: string;
  distance_km?: number;
  delivery_time?: string;
  image_url?: string | null;
  is_open?: boolean;
}

/** Shared keyboard focus ring for the tappable cards on this surface. */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

const IMAGE_SIZE = {
  sm: { box: "size-16 rounded-xl", px: "64px", icon: 20 },
  lg: { box: "size-20 rounded-2xl", px: "80px", icon: 24 }
} as const;

/**
 * Restaurant photo with a fixed square box, so a slow or missing image never
 * shifts the text beside it. A failed load falls back to a neutral storefront
 * mark instead of a broken-image glyph. Failure is tracked per URL, so a card
 * reused for a different restaurant tries its new image.
 */
export function RestaurantImage({
  src,
  size = "sm",
  muted = false
}: {
  src?: string | null;
  size?: keyof typeof IMAGE_SIZE;
  /** Desaturate, for a restaurant that is closed right now. */
  muted?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const s = IMAGE_SIZE[size];
  const show = Boolean(src) && failedSrc !== src;
  return (
    <span
      className={cn(
        "relative shrink-0 overflow-hidden bg-cream-deep flex items-center justify-center",
        s.box
      )}
    >
      {show ? (
        <Image
          src={src!}
          alt=""
          fill
          sizes={s.px}
          className={cn("object-cover", muted && "grayscale")}
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <Store size={s.icon} className="text-ink-muted" aria-hidden />
      )}
    </span>
  );
}

function Rating({ value, count }: { value?: number; count?: string | number }) {
  if (typeof value !== "number" || !(value > 0)) return null;
  const countText = typeof count === "number" ? count.toLocaleString("en-IN") : count;
  return (
    <span className="inline-flex items-center gap-1 shrink-0 text-xs">
      <Star size={11} className="fill-leaf-text text-leaf-text" aria-hidden />
      <span className="sr-only">Rated </span>
      <span className="tabular-nums font-medium text-ink-soft">{value}</span>
      {countText ? (
        <span className="text-ink-muted">
          <span className="sr-only">from </span>({countText})
        </span>
      ) : null}
    </span>
  );
}

/**
 * Swiggy sends SLA strings shouting ("40-50 MINS"). Lower-case only the unit
 * so the numbers are untouched.
 */
function formatDeliveryTime(t: string) {
  return t.replace(/\bMINS?\b/g, (m) => m.toLowerCase());
}

/**
 * A row of facts separated by middots. Empty entries are dropped, so a
 * restaurant with no cost or area never shows a stray separator.
 */
function Facts({ items, className }: { items: ReactNode[]; className?: string }) {
  const shown = items.filter((x) => x !== null && x !== undefined && x !== false && x !== "");
  if (shown.length === 0) return null;
  return (
    <span className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-ink-muted", className)}>
      {shown.map((node, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden>·</span>}
          {node}
        </Fragment>
      ))}
    </span>
  );
}

function areaText(area?: string, distance?: string) {
  if (!area) return null;
  return (
    <span className="min-w-0 max-w-full truncate">
      {area}
      {distance ? `, ${distance}` : ""}
    </span>
  );
}

function ClosedLabel() {
  return <span className="text-xs font-medium text-ember-text">Closed now</span>;
}

/**
 * A delivery restaurant. Tapping opens its full menu, where every dish is
 * scored. That is the reason to have a restaurant surface at all.
 *
 * A closed restaurant still opens: its menu and scores are worth reading, and
 * the menu screen says plainly that it is closed. It used to be a dead card at
 * 60% opacity, which also dropped its text below AA contrast.
 */
export function RestaurantCard({ r }: { r: ScoredRestaurant }) {
  const closed = r.is_open === false;
  const linkable = Boolean(r.id);
  const body = (
    <>
      <RestaurantImage src={r.image_url} muted={closed} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className="block min-w-0 flex-1 text-sm font-medium leading-snug line-clamp-1">{r.name}</span>
          <Rating value={r.rating} count={r.total_ratings} />
        </span>
        {r.cuisines && r.cuisines.length > 0 && (
          <span className="block text-xs text-ink-muted mt-1 line-clamp-1">{r.cuisines.join(", ")}</span>
        )}
        <Facts
          className="mt-1.5"
          items={[
            closed && <ClosedLabel key="closed" />,
            r.delivery_time && (
              <span key="eta" className="tabular-nums text-ink-soft">
                {formatDeliveryTime(r.delivery_time)}
              </span>
            ),
            r.cost_for_two,
            areaText(r.area, typeof r.distance_km === "number" ? `${r.distance_km} km` : undefined)
          ]}
        />
      </span>
      {linkable && <ChevronRight size={16} className="text-ink-muted shrink-0 self-center" aria-hidden />}
    </>
  );

  const className = cn("card-solid w-full text-left p-3 flex items-start gap-3", linkable && "transition-colors hover:bg-cream-deep/40", linkable && FOCUS_RING);

  if (!linkable) return <div className={className}>{body}</div>;
  return (
    <Link href={`/restaurant/${r.id}`} className={className}>
      {body}
    </Link>
  );
}

/**
 * The header block on a restaurant's menu screen: photo, name, and the facts a
 * person scans before reading a menu (open or not, rating, delivery time,
 * cost). Lives here so it shares the image fallback and fact formatting with
 * the list card.
 */
export function RestaurantHeader({ r }: { r: ScoredRestaurant }) {
  const closed = r.is_open === false;
  return (
    <header className="flex items-start gap-4">
      <RestaurantImage src={r.image_url} size="lg" muted={closed} />
      <div className="min-w-0 flex-1">
        <h1 className="display text-3xl leading-tight break-words">{r.name}</h1>
        {r.cuisines && r.cuisines.length > 0 && (
          <p className="text-sm text-ink-muted mt-1">{r.cuisines.join(", ")}</p>
        )}
        <Facts
          className="mt-2"
          items={[
            typeof r.rating === "number" && r.rating > 0 && (
              <Rating key="rating" value={r.rating} count={r.total_ratings} />
            ),
            r.delivery_time && (
              <span key="eta" className="tabular-nums text-ink-soft">
                {formatDeliveryTime(r.delivery_time)}
              </span>
            ),
            r.cost_for_two,
            areaText(r.area)
          ]}
        />
      </div>
    </header>
  );
}

/** A Dineout restaurant, with the ordering brief built from its cuisines. */
export interface DineoutRestaurantView {
  id: string;
  name: string;
  cuisines?: string[];
  rating?: number;
  rating_count?: number;
  cost_for_two?: string;
  area?: string;
  distance?: string;
  image_url?: string | null;
  highlights?: string[];
  offers?: string[];
  brief?: {
    cuisines_used: string[];
    easier: { name: string; peak_mg_dl: number; carbs_g: number }[];
    harder: { name: string; peak_mg_dl: number; carbs_g: number }[];
    note: string;
  } | null;
}

export function DineoutCard({ r }: { r: DineoutRestaurantView }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="card-solid overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "w-full text-left p-3 flex items-start gap-3 hover:bg-cream-deep/40 transition-colors",
          open ? "rounded-t-2xl" : "rounded-2xl",
          FOCUS_RING,
          "focus-visible:ring-inset focus-visible:ring-offset-0"
        )}
      >
        <RestaurantImage src={r.image_url} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span className="block min-w-0 flex-1 text-sm font-medium leading-snug line-clamp-1">{r.name}</span>
            <Rating value={r.rating} count={r.rating_count} />
          </span>
          {r.cuisines && r.cuisines.length > 0 && (
            <span className="block text-xs text-ink-muted mt-1 line-clamp-1">{r.cuisines.join(", ")}</span>
          )}
          <Facts className="mt-1.5" items={[r.cost_for_two, areaText(r.area, r.distance)]} />
          {r.offers && r.offers.length > 0 && (
            <span className="flex items-center gap-1 mt-1.5 text-xs text-swiggy-text min-w-0">
              <Tag size={11} className="shrink-0" aria-hidden />
              <span className="truncate">{r.offers[0]}</span>
              {r.offers.length > 1 && (
                <span className="shrink-0 text-ink-muted">
                  +{r.offers.length - 1}
                  <span className="sr-only"> more offers</span>
                </span>
              )}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            "text-ink-muted shrink-0 self-center transition-transform motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div id={panelId} className="px-3 pb-3 border-t border-ink/10 pt-3 space-y-3">
          {r.highlights && r.highlights.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Highlights">
              {r.highlights.map((h) => (
                <li key={h} className="rounded-full bg-cream border border-ink/10 px-2.5 py-1 text-xs text-ink-soft">
                  {h}
                </li>
              ))}
            </ul>
          )}

          {/* Dineout has no menu, so this is a brief on the cuisine, scored
              against this user's own model. The heading names the cuisine so it
              never reads as this kitchen's dishes. */}
          {r.brief ? (
            <div className="rounded-xl bg-cream p-3">
              <p className="text-sm font-medium text-ink-soft">
                Typical {r.brief.cuisines_used.join(" and ")} dishes, for you
              </p>
              <p className="text-xs text-ink-muted mt-0.5 mb-2.5">Estimated glucose peak, mg/dL</p>
              <BriefRow label="Easier on you" items={r.brief.easier} tone="leaf" />
              <BriefRow label="Hits hardest" items={r.brief.harder} tone="ember" />
              <p className="text-xs text-ink-muted leading-relaxed mt-2.5">{r.brief.note}</p>
            </div>
          ) : (
            <p className="text-xs text-ink-muted leading-relaxed">
              We don&apos;t have typical dishes for this cuisine, so there&apos;s no ordering
              brief. We&apos;d rather say nothing than guess.
            </p>
          )}

          <p className="text-xs text-ink-muted leading-relaxed">
            GlycoCart doesn&apos;t book tables. Swiggy&apos;s live booking API has no cancel,
            so you book in the Swiggy app and keep control of it.
          </p>
        </div>
      )}
    </div>
  );
}

function BriefRow({
  label,
  items,
  tone
}: {
  label: string;
  items: { name: string; peak_mg_dl: number }[];
  tone: "leaf" | "ember";
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2 last:mb-0">
      <p className="section-label mb-1.5">{label}</p>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-soft">{i.name}</span>
            <span className="flex items-center gap-1.5 shrink-0 tabular-nums">
              <span aria-hidden className={cn("size-2 rounded-full", tone === "leaf" ? "bg-leaf" : "bg-ember")} />
              <span>
                <span className="sr-only">estimated peak </span>~{i.peak_mg_dl}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
