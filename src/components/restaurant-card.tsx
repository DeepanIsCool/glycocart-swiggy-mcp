"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, Store, Clock, MapPin, ChevronRight, ChevronDown, Tag } from "lucide-react";
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

function Thumb({ src, alt }: { src?: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative shrink-0 size-16 rounded-xl overflow-hidden bg-cream-deep flex items-center justify-center">
      {src && !failed ? (
        <Image src={src} alt={alt} fill sizes="64px" className="object-cover" onError={() => setFailed(true)} />
      ) : (
        <Store size={20} className="text-ink-muted" aria-hidden />
      )}
    </span>
  );
}

function Rating({ value, count }: { value?: number; count?: string | number }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 shrink-0 text-xs">
      <Star size={11} className="fill-leaf-text text-leaf-text" />
      <span className="tabular-nums font-medium">{value}</span>
      {count ? <span className="text-ink-muted">({count})</span> : null}
    </span>
  );
}

/**
 * A delivery restaurant. Tapping opens its full menu, where every dish is
 * scored — the reason to have a restaurant surface at all.
 */
export function RestaurantCard({ r }: { r: ScoredRestaurant }) {
  const closed = r.is_open === false;
  const body = (
    <>
      <Thumb src={r.image_url} alt="" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="block text-sm font-medium leading-snug line-clamp-1 flex-1">{r.name}</span>
          <Rating value={r.rating} count={r.total_ratings} />
        </span>
        {r.cuisines && r.cuisines.length > 0 && (
          <span className="block text-xs text-ink-muted mt-1 line-clamp-1">{r.cuisines.join(", ")}</span>
        )}
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-muted mt-1.5">
          {r.delivery_time && (
            <span className="inline-flex items-center gap-1">
              <Clock size={11} /> {r.delivery_time}
            </span>
          )}
          {r.cost_for_two && <span>{r.cost_for_two}</span>}
          {r.area && (
            <span className="inline-flex items-center gap-1 min-w-0">
              <MapPin size={11} className="shrink-0" />
              <span className="truncate">
                {r.area}
                {typeof r.distance_km === "number" ? ` · ${r.distance_km} km` : ""}
              </span>
            </span>
          )}
          {closed && <span className="text-ember-text">closed right now</span>}
        </span>
      </span>
      {r.id && !closed && <ChevronRight size={16} className="text-ink-muted shrink-0 self-center" />}
    </>
  );

  const className = cn(
    "card-solid w-full text-left p-3 flex items-start gap-3 transition-colors",
    closed ? "opacity-60" : "hover:bg-cream-deep/40"
  );

  if (!r.id || closed) return <div className={className}>{body}</div>;
  return (
    <Link href={`/restaurant/${r.id}`} className={className}>
      {body}
    </Link>
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

  return (
    <div className="card-solid overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full text-left p-3 flex items-start gap-3 hover:bg-cream-deep/40 transition-colors"
      >
        <Thumb src={r.image_url} alt="" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="block text-sm font-medium leading-snug line-clamp-1 flex-1">{r.name}</span>
            <Rating value={r.rating} count={r.rating_count} />
          </span>
          {r.cuisines && r.cuisines.length > 0 && (
            <span className="block text-xs text-ink-muted mt-1 line-clamp-1">{r.cuisines.join(", ")}</span>
          )}
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-muted mt-1.5">
            {r.cost_for_two && <span>{r.cost_for_two}</span>}
            {r.area && (
              <span className="inline-flex items-center gap-1 min-w-0">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">
                  {r.area}
                  {r.distance ? ` · ${r.distance}` : ""}
                </span>
              </span>
            )}
          </span>
          {r.offers && r.offers.length > 0 && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-swiggy-text">
              <Tag size={11} /> {r.offers[0]}
              {r.offers.length > 1 && <span className="text-ink-muted">+{r.offers.length - 1}</span>}
            </span>
          )}
        </span>
        <ChevronDown
          size={15}
          className={cn("text-ink-muted shrink-0 self-center transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 border-t border-ink/8 pt-3 space-y-3">
          {r.highlights && r.highlights.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {r.highlights.map((h) => (
                <span key={h} className="rounded-full bg-cream border border-ink/10 px-2.5 py-1 text-xs text-ink-soft">
                  {h}
                </span>
              ))}
            </div>
          )}

          {/* The point of a glucose app on a booking surface: Dineout has no
              menu, so we brief the cuisine against this user's own model. */}
          {r.brief ? (
            <div className="rounded-xl bg-cream p-3">
              <p className="mono text-ink-muted text-xs mb-2.5">what to order here</p>
              <BriefRow label="easier on you" items={r.brief.easier} tone="leaf" />
              <BriefRow label="hits hardest" items={r.brief.harder} tone="ember" />
              <p className="text-xs text-ink-muted leading-relaxed mt-2.5">{r.brief.note}</p>
            </div>
          ) : (
            <p className="text-xs text-ink-muted leading-relaxed">
              We don&apos;t have typical dishes for this cuisine, so there&apos;s no ordering
              brief — we&apos;d rather say nothing than guess.
            </p>
          )}

          <p className="text-xs text-ink-muted leading-relaxed">
            GlycoCart doesn&apos;t book tables — Swiggy&apos;s live booking API has no cancel,
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
      <p className="mono text-ink-muted text-xs mb-1.5">{label}</p>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-soft">{i.name}</span>
            <span className="flex items-center gap-1.5 shrink-0 tabular-nums">
              <span className={cn("size-2 rounded-full", tone === "leaf" ? "bg-leaf" : "bg-ember")} />
              {i.peak_mg_dl}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
