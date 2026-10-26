"use client";

import { preferenceRank } from "@/lib/preferences";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { DishCard, type ScoredItem } from "./dish-card";
import { cn } from "@/lib/utils";

export interface MenuCategory {
  title: string;
  items: ScoredItem[];
}

type Notice = { tone: "ok" | "error"; text: string; href?: string; cta?: string };

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

const sectionId = (i: number) => `menu-section-${i}`;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The menu route returns `{ error: string }`; the Swiggy tool returns `{ error: { message } }`. */
function errorText(data: unknown, fallback: string): string {
  const e = (data as { error?: unknown; message?: unknown } | null)?.error;
  if (typeof e === "string" && e) return e;
  const m = (e as { message?: unknown } | undefined)?.message;
  if (typeof m === "string" && m) return m;
  const top = (data as { message?: unknown } | null)?.message;
  if (typeof top === "string" && top) return top;
  return fallback;
}

/**
 * A restaurant menu where every dish carries a glucose forecast for the person
 * reading it.
 *
 * "Best for you" is the reason this page exists: Swiggy can sort a menu by
 * popularity or price, but not by what it will do to *your* blood sugar. It
 * flattens every loaded category and ranks by fit, so the top of the list is
 * the answer rather than something to hunt for.
 */
export function RestaurantMenu({
  restaurantId,
  initial,
  hasMore,
  totalCategories,
  addressMissing,
  defaultVegOnly = false
}: {
  restaurantId: string;
  initial: MenuCategory[];
  hasMore: boolean;
  /** Swiggy's count of menu sections, when it sends one. */
  totalCategories?: number;
  addressMissing?: boolean;
  /** Starts on veg-only for a vegetarian, vegan or Jain profile. */
  defaultVegOnly?: boolean;
}) {
  const [categories, setCategories] = useState(initial);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(hasMore);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sort, setSort] = useState<"menu" | "best">("menu");
  const [vegOnly, setVegOnly] = useState(defaultVegOnly);
  const [notice, setNotice] = useState<Notice | null>(null);
  const adding = useRef(false);
  const [active, setActive] = useState(0);

  const chipBarRef = useRef<HTMLElement>(null);
  const chipScrollRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/restaurant/${restaurantId}?page=${page + 1}`);
      const data = await res.json().catch(() => null);
      // A failed page used to set `more` to false silently, so the rest of the
      // menu vanished with no way back. Keep the button and offer a retry.
      if (!res.ok || data?.success === false) {
        setLoadError(errorText(data, "Couldn't load the rest of the menu."));
        return;
      }
      if (Array.isArray(data?.categories)) {
        setCategories((c) => [...c, ...data.categories]);
        setPage((p) => p + 1);
        setMore(Boolean(data.has_more));
      } else {
        setMore(false);
      }
    } catch {
      setLoadError("Couldn't reach Swiggy. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function addToCart(item: ScoredItem) {
    // Each add reads the cart, merges, and writes the whole cart back, so two
    // overlapping adds can drop the first dish. One at a time.
    if (adding.current) return;
    if (addressMissing) {
      setNotice({ tone: "error", text: "Pick a delivery address first.", href: "/settings", cta: "Settings" });
      return;
    }
    setNotice(null);
    adding.current = true;
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: item.restaurant_id,
          restaurantName: item.restaurant_name,
          menuItemId: item.id,
          quantity: 1,
          mode: "add"
        })
      });
      const data = await res.json().catch(() => ({}));
      if (data?.conflict === "different_restaurant") {
        setNotice({
          tone: "error",
          text: `Your cart already has items from ${data.current_restaurant}. Swiggy carts hold one restaurant at a time, so empty it first.`,
          href: "/cart",
          cta: "Open cart"
        });
        return;
      }
      if (!res.ok || data?.success === false) {
        setNotice({ tone: "error", text: errorText(data, "Couldn't add that to your cart.") });
        return;
      }
      setNotice({ tone: "ok", text: `Added ${item.name} to your Swiggy cart.`, href: "/cart", cta: "View cart" });
    } catch {
      setNotice({ tone: "error", text: "Couldn't reach Swiggy. Try again." });
    } finally {
      adding.current = false;
    }
  }

  // Confirmations clear themselves; errors stay until dismissed or replaced.
  useEffect(() => {
    if (!notice || notice.tone !== "ok") return;
    const t = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const filtered = useMemo(
    () =>
      categories
        .map((c) => ({ ...c, items: vegOnly ? c.items.filter((i) => i.is_veg) : c.items }))
        .filter((c) => c.items.length > 0),
    [categories, vegOnly]
  );

  const ranked = useMemo(() => {
    const all = filtered.flatMap((c) => c.items);
    const scored = all.filter((i) => i.glycemic);
    // Avoid-list matches rank below every clean dish, whatever their score.
    scored.sort((a, b) => preferenceRank(b) - preferenceRank(a));
    return scored;
  }, [filtered]);

  const totalItems = filtered.reduce((n, c) => n + c.items.length, 0);
  const sectionCount = filtered.length;
  const showSectionNav = sort === "menu" && sectionCount > 1;

  // Track which section is under the sticky bar, so its chip is marked current.
  useEffect(() => {
    if (!showSectionNav) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = (chipBarRef.current?.getBoundingClientRect().bottom ?? 0) + 8;
      let current = 0;
      for (let i = 0; i < sectionCount; i++) {
        const el = document.getElementById(sectionId(i));
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = i;
        else break;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [showSectionNav, sectionCount]);

  // Keep the current chip visible in the horizontally scrolling bar.
  useEffect(() => {
    const bar = chipScrollRef.current;
    const chip = chipRefs.current[active];
    if (!bar || !chip) return;
    const left = chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2;
    bar.scrollTo({ left: Math.max(0, left), behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [active]);

  function jumpTo(i: number) {
    const el = document.getElementById(sectionId(i));
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    setActive(i);
    // Move focus with the view, so keyboard and screen-reader users land in
    // the section they picked rather than back at the chip.
    el.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }

  const loadedSections = categories.length;
  const sectionProgress =
    typeof totalCategories === "number" && totalCategories > loadedSections
      ? `${loadedSections} of ${totalCategories} sections loaded`
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div role="group" aria-label="Order dishes by" className="flex gap-2">
          <Toggle active={sort === "menu"} onClick={() => setSort("menu")}>
            Menu order
          </Toggle>
          <Toggle active={sort === "best"} onClick={() => setSort("best")}>
            Best for you
          </Toggle>
        </div>
        <Toggle active={vegOnly} onClick={() => setVegOnly(!vegOnly)}>
          Veg only
        </Toggle>
      </div>

      {/* Section jump bar. A Swiggy menu runs to dozens of sections; without
          this the only way to reach desserts was to scroll past everything. */}
      {showSectionNav && (
        <nav
          ref={chipBarRef}
          aria-label="Menu sections"
          className="sticky top-[var(--appbar-h)] z-10 -mx-5 md:-mx-10 mb-4 border-b border-ink/10 bg-cream/95 backdrop-blur-md"
        >
          <div
            ref={chipScrollRef}
            className="relative flex gap-2 overflow-x-auto px-5 md:px-10 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {filtered.map((cat, i) => (
              <button
                key={`${cat.title}-${i}`}
                ref={(el) => {
                  chipRefs.current[i] = el;
                }}
                type="button"
                onClick={() => jumpTo(i)}
                aria-current={active === i ? "location" : undefined}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 min-h-11 rounded-full border px-4 text-sm whitespace-nowrap transition-colors motion-reduce:transition-none",
                  FOCUS_RING,
                  active === i
                    ? "bg-ink text-cream border-ink font-medium"
                    : "bg-cream-warm border-ink/10 text-ink-soft hover:text-ink"
                )}
              >
                <span className="max-w-[14rem] truncate">{cat.title}</span>
                <span className="tabular-nums text-xs">
                  <span className="sr-only">, </span>
                  {cat.items.length}
                  <span className="sr-only"> dishes</span>
                </span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {totalItems === 0 && (
        <EmptyCard
          title={vegOnly ? "No vegetarian dishes yet" : "This menu came back empty"}
          action={
            vegOnly ? (
              <button type="button" onClick={() => setVegOnly(false)} className={cn(SECONDARY_BTN, FOCUS_RING)}>
                Show all dishes
              </button>
            ) : null
          }
        >
          {vegOnly
            ? more
              ? "None in the sections loaded so far. Load more of the menu below, or show everything."
              : "This restaurant lists no vegetarian dishes."
            : "Swiggy returned no dishes for this restaurant. It may be updating its menu."}
        </EmptyCard>
      )}

      {sort === "best" && totalItems > 0 ? (
        <>
          <p className="text-sm text-ink-muted leading-relaxed mb-3">
            Ranked by estimated fit for your profile. {ranked.length} of {totalItems} dishes could be
            scored; the rest are left out because we won&apos;t rank what we can&apos;t score.
            {more && " Only the sections loaded so far are ranked."}
          </p>
          {ranked.length === 0 ? (
            <EmptyCard
              title="Nothing here could be scored"
              action={
                <button type="button" onClick={() => setSort("menu")} className={cn(SECONDARY_BTN, FOCUS_RING)}>
                  Show menu order
                </button>
              }
            >
              None of the loaded dishes matched our food tables, so there&apos;s no ranking to show.
              You can still read them, unscored, in menu order.
            </EmptyCard>
          ) : (
            <ol className="space-y-2" aria-label="Dishes ranked for you">
              {ranked.map((item, i) => (
                <li key={`${item.id ?? item.name}-${i}`}>
                  <DishCard item={item} rank={i + 1} onAddToCart={addToCart} showMenuLink={false} />
                </li>
              ))}
            </ol>
          )}
        </>
      ) : sort === "menu" ? (
        <div className="space-y-7">
          {filtered.map((cat, ci) => (
            <section
              key={`${cat.title}-${ci}`}
              id={sectionId(ci)}
              aria-labelledby={`${sectionId(ci)}-title`}
              className="scroll-mt-[calc(var(--appbar-h)+4.25rem)]"
            >
              <h2
                id={`${sectionId(ci)}-title`}
                tabIndex={-1}
                className="flex items-baseline justify-between gap-3 mb-2.5 focus:outline-none"
              >
                <span className="text-sm font-medium text-ink-soft min-w-0">{cat.title}</span>
                <span className="text-xs text-ink-muted tabular-nums shrink-0">
                  {cat.items.length} {cat.items.length === 1 ? "dish" : "dishes"}
                </span>
              </h2>
              <div className="space-y-2">
                {cat.items.map((item, i) => (
                  <DishCard key={`${item.id ?? item.name}-${i}`} item={item} onAddToCart={addToCart} showMenuLink={false} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {more && (
        <div className="mt-6">
          {/* Placeholders in the shape of dish cards while the next page loads. */}
          {loading && (
            <div className="space-y-2 mb-3" aria-hidden>
              {[0, 1].map((i) => (
                <div key={i} className="card-solid p-3 flex items-start gap-3">
                  <span className="size-14 rounded-xl bg-cream-deep shrink-0 animate-pulse motion-reduce:animate-none" />
                  <span className="flex-1 space-y-2 pt-1">
                    <span className="block h-3.5 w-2/3 rounded bg-cream-deep animate-pulse motion-reduce:animate-none" />
                    <span className="block h-3 w-1/3 rounded bg-cream-deep animate-pulse motion-reduce:animate-none" />
                  </span>
                </div>
              ))}
            </div>
          )}
          {loadError && (
            <p role="alert" className="text-sm text-ember-text mb-2">
              {loadError}
            </p>
          )}
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            aria-busy={loading}
            className={cn(
              "w-full min-h-11 inline-flex items-center justify-center gap-2 rounded-full border border-ink/10 bg-cream-warm px-5 text-sm font-medium text-ink-soft transition-colors hover:bg-cream-deep/60 hover:text-ink disabled:cursor-wait",
              FOCUS_RING
            )}
          >
            {loading && <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden />}
            {loading ? "Loading more of the menu…" : loadError ? "Try again" : "Load more of the menu"}
          </button>
          {sectionProgress && (
            <p className="text-xs text-ink-muted text-center mt-2 tabular-nums">{sectionProgress}</p>
          )}
        </div>
      )}

      {/* Cart feedback floats above the tab bar. It used to render at the top
          of the menu, out of sight for anyone who had scrolled to a dish. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-h)+0.75rem)] z-30 px-4"
      >
        {notice && (
          <div className="pointer-events-auto max-w-2xl mx-auto card-solid flex items-center gap-2 py-1.5 pl-4 pr-1.5">
            <p
              className={cn(
                "flex-1 min-w-0 text-sm leading-snug py-1.5",
                notice.tone === "error" ? "text-ember-text" : "text-ink-soft"
              )}
            >
              {notice.text}
            </p>
            {notice.href && notice.cta && (
              <Link
                href={notice.href}
                className={cn(
                  "shrink-0 inline-flex items-center min-h-11 rounded-full px-3 text-sm font-medium text-leaf-text hover:bg-cream-deep/60",
                  FOCUS_RING
                )}
              >
                {notice.cta}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss"
              className={cn(
                "shrink-0 inline-flex items-center justify-center size-11 rounded-full text-ink-muted hover:text-ink hover:bg-cream-deep/60",
                FOCUS_RING
              )}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const SECONDARY_BTN =
  "inline-flex items-center justify-center min-h-11 rounded-full border border-ink/10 bg-cream px-4 text-sm font-medium text-ink-soft hover:text-ink hover:bg-cream-deep/60 transition-colors";

function EmptyCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card-solid p-5 mb-4">
      <p className="font-medium mb-1">{title}</p>
      <p className="text-sm text-ink-muted leading-relaxed">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center min-h-11 rounded-full border px-4 text-sm transition-colors motion-reduce:transition-none",
        FOCUS_RING,
        active
          ? "bg-leaf-pale border-leaf/30 text-leaf-text font-medium"
          : "bg-cream-warm border-ink/10 text-ink-muted hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
