"use client";

import { useMemo, useState } from "react";
import { Loader2, Sparkles, ListTree, Leaf } from "lucide-react";
import { DishCard, type ScoredItem } from "./dish-card";
import { cn } from "@/lib/utils";

export interface MenuCategory {
  title: string;
  items: ScoredItem[];
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
  addressMissing
}: {
  restaurantId: string;
  initial: MenuCategory[];
  hasMore: boolean;
  addressMissing?: boolean;
}) {
  const [categories, setCategories] = useState(initial);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(hasMore);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<"menu" | "best">("menu");
  const [vegOnly, setVegOnly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadMore() {
    setLoading(true);
    try {
      const res = await fetch(`/api/restaurant/${restaurantId}?page=${page + 1}`);
      const data = await res.json();
      if (Array.isArray(data?.categories)) {
        setCategories((c) => [...c, ...data.categories]);
        setPage((p) => p + 1);
        setMore(Boolean(data.has_more));
      } else {
        setMore(false);
      }
    } catch {
      setMore(false);
    } finally {
      setLoading(false);
    }
  }

  async function addToCart(item: ScoredItem) {
    if (addressMissing) {
      setNotice("Pick a delivery address in Settings first.");
      return;
    }
    setNotice(null);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: item.restaurant_id,
          restaurantName: item.restaurant_name,
          menuItemId: item.id,
          quantity: 1
        })
      });
      const data = await res.json();
      if (data?.conflict === "different_restaurant") {
        setNotice(
          `Your cart already has items from ${data.current_restaurant}. Swiggy carts hold one restaurant at a time — empty it from the Cart tab first.`
        );
        return;
      }
      if (!res.ok || data?.success === false) {
        setNotice(data?.error?.message ?? data?.message ?? "Couldn't add that to your cart.");
        return;
      }
      setNotice(`Added ${item.name} to your Swiggy cart.`);
    } catch {
      setNotice("Couldn't reach Swiggy. Try again.");
    }
  }

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
    scored.sort((a, b) => (b.glycemic!.match_score ?? 0) - (a.glycemic!.match_score ?? 0));
    return scored;
  }, [filtered]);

  const totalItems = filtered.reduce((n, c) => n + c.items.length, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Toggle active={sort === "menu"} onClick={() => setSort("menu")} Icon={ListTree}>
          Menu order
        </Toggle>
        <Toggle active={sort === "best"} onClick={() => setSort("best")} Icon={Sparkles}>
          Best for you
        </Toggle>
        <Toggle active={vegOnly} onClick={() => setVegOnly(!vegOnly)} Icon={Leaf}>
          Veg only
        </Toggle>
      </div>

      {notice && (
        <p className="text-sm text-leaf-text bg-leaf-pale/50 rounded-xl px-4 py-2.5 mb-4">{notice}</p>
      )}

      {totalItems === 0 && (
        <p className="text-sm text-ink-muted">
          {vegOnly ? "No vegetarian items in the categories loaded so far." : "This menu came back empty."}
        </p>
      )}

      {sort === "best" ? (
        <>
          <p className="text-sm text-ink-muted leading-relaxed mb-3">
            Ranked by predicted fit for your profile. {ranked.length} of {totalItems} items could be
            estimated; the rest aren&apos;t shown here because we won&apos;t rank what we can&apos;t
            score.
          </p>
          <div className="space-y-2">
            {ranked.map((item, i) => (
              <DishCard key={`${item.id}-${i}`} item={item} rank={i + 1} onAddToCart={addToCart} showMenuLink={false} />
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {filtered.map((cat) => (
            <section key={cat.title}>
              <h2 className="mono text-ink-muted text-xs mb-2.5">{cat.title}</h2>
              <div className="space-y-2">
                {cat.items.map((item, i) => (
                  <DishCard key={`${item.id}-${i}`} item={item} onAddToCart={addToCart} showMenuLink={false} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {more && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="btn-ghost border border-ink/10 rounded-full mt-6 disabled:opacity-60"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? "loading…" : "load more of the menu"}
        </button>
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  Icon,
  children
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs transition-colors",
        active
          ? "bg-leaf-pale border-leaf/30 text-leaf-text font-medium"
          : "bg-cream-warm border-ink/10 text-ink-muted hover:text-ink"
      )}
    >
      <Icon size={13} />
      {children}
    </button>
  );
}
