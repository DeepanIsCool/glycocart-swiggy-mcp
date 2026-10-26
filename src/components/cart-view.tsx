"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, ExternalLink, MapPin, UtensilsCrossed, Minus, Plus, RefreshCw } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";

function CartThumb({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative shrink-0 size-14 rounded-xl overflow-hidden bg-cream-deep flex items-center justify-center">
      {src && !failed ? (
        <Image src={src} alt="" fill sizes="56px" className="object-cover" onError={() => setFailed(true)} />
      ) : (
        <UtensilsCrossed size={18} className="text-ink-muted" aria-hidden />
      )}
    </span>
  );
}

interface CartItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  price?: number;
  strikeout_price?: number;
  image_url?: string | null;
  in_stock?: boolean;
}

interface Cart {
  cart_id: string | null;
  restaurant: { id?: string; name?: string; area?: string } | null;
  delivery_eta?: string | null;
  needsAddress?: boolean;
  items: CartItem[];
  pricing: {
    item_total?: number;
    delivery_charge?: number;
    taxes_and_charges?: number;
    to_pay?: number;
  } | null;
  offers?: { coupon_applied?: string; coupon_discount?: number } | null;
  glucose?: {
    scored_items: number;
    unscored_items: number;
    total_carbs_g: number;
    total_calories: number;
    highest_single_item_peak_mg_dl: number | null;
    note: string;
  };
}

/** A cart-shaped response, as opposed to `{ success: false, message }`. */
function isCart(data: unknown): data is Cart {
  return typeof data === "object" && data !== null && Array.isArray((data as Cart).items);
}

function errorMessage(data: unknown, fallback: string): string {
  if (typeof data === "object" && data !== null) {
    const d = data as { error?: unknown; message?: unknown; recovery?: unknown };
    if (typeof d.error === "string") return d.error;
    // A failed Swiggy call arrives as { success:false, error:{ message }, recovery? }.
    const nested = (d.error as { message?: unknown } | undefined)?.message;
    if (typeof nested === "string") {
      return typeof d.recovery === "string" ? `${nested} Pick another address in Settings.` : nested;
    }
    if (typeof d.message === "string") return d.message;
  }
  return fallback;
}

export function CartView({ addressLabel }: { addressLabel: string | null }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Which line is being changed, or "clear" for the whole cart.
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/cart");
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errorMessage(data, "Couldn't load your cart."));
      if (!isCart(data)) throw new Error(errorMessage(data, "Couldn't load your cart."));
      setCart(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load your cart.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setQuantity(item: CartItem, quantity: number) {
    const restaurantId = cart?.restaurant?.id;
    const restaurantName = cart?.restaurant?.name;
    if (!restaurantId || !restaurantName) return;
    setBusy(item.menu_item_id);
    setActionError(null);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, restaurantName, menuItemId: item.menu_item_id, quantity, mode: "set" })
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok || !isCart(data)) {
        throw new Error(errorMessage(data, "Swiggy didn't accept that change."));
      }
      setCart(data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Swiggy didn't accept that change.");
    } finally {
      setBusy(null);
    }
  }

  async function clearCart() {
    setBusy("clear");
    setActionError(null);
    try {
      const res = await fetch("/api/cart", { method: "DELETE" });
      if (!res.ok) {
        throw new Error(errorMessage(await res.json().catch(() => ({})), "Couldn't empty the cart."));
      }
      setConfirmClear(false);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't empty the cart.");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !cart) {
    return (
      <div role="status" aria-live="polite" className="space-y-3">
        <span className="sr-only">Loading your Swiggy cart</span>
        <div className="card-solid h-20 animate-pulse" aria-hidden />
        <div className="card-solid h-40 animate-pulse" aria-hidden />
        <div className="card-solid h-28 animate-pulse" aria-hidden />
      </div>
    );
  }

  if (loadError) {
    const expired = /expired/i.test(loadError);
    return (
      <div className="card-solid p-5" role="alert">
        <p className="font-medium mb-1">Your cart didn&apos;t load</p>
        <p className="text-sm text-ink-soft leading-relaxed">{loadError}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {expired ? (
            <a href="/api/auth/swiggy/login" className="btn-primary text-sm min-h-11">
              Reconnect Swiggy
            </a>
          ) : (
            <button type="button" onClick={load} className="btn-primary text-sm min-h-11">
              <RefreshCw size={14} aria-hidden /> Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  if (cart?.needsAddress) {
    return (
      <div className="card-solid p-6">
        <p className="font-medium mb-1">Choose a delivery address first</p>
        <p className="text-sm text-ink-muted leading-relaxed">
          A Swiggy cart belongs to one delivery address, so there is no cart to show until
          you pick one.
        </p>
        <Link href="/settings" className="btn-primary text-sm min-h-11 mt-4">
          Pick an address in Settings
        </Link>
      </div>
    );
  }

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="card-solid p-6">
        <p className="font-medium mb-1">Your cart is empty</p>
        <p className="text-sm text-ink-muted leading-relaxed">
          Ask GlycoCart for something to eat, then add a dish from a result. It lands in
          your real Swiggy cart and shows up here.
        </p>
        <Link href="/chat" className="btn-primary text-sm min-h-11 mt-4">
          Go to chat
        </Link>
      </div>
    );
  }

  const g = cart?.glucose;
  const p = cart?.pricing;
  // The cart response often carries only a restaurant name, and the update
  // call needs the id. Without it, quantities are read-only here.
  const canEdit = Boolean(cart?.restaurant?.id && cart?.restaurant?.name);
  const itemCount = items.reduce((n, i) => n + (Number(i.quantity) || 0), 0);

  return (
    <div className="space-y-4">
      <section className="card-solid p-4" aria-label="Restaurant and address">
        {cart?.restaurant?.name && (
          <>
            <p className="font-medium">{cart.restaurant.name}</p>
            {cart.restaurant.area && <p className="text-sm text-ink-muted">{cart.restaurant.area}</p>}
          </>
        )}
        {/* A Swiggy cart belongs to one address. If the Swiggy app has a
            different address selected, this cart looks like it vanished, so
            name the address rather than leaving it a mystery. */}
        {addressLabel && (
          <p className="flex items-start gap-2 text-sm text-ink-soft leading-relaxed mt-1.5">
            <MapPin size={14} className="shrink-0 mt-1 text-ink-muted" aria-hidden />
            <span>
              <span className="sr-only">Delivering to </span>
              {addressLabel}
            </span>
          </p>
        )}
        {cart?.delivery_eta && (
          <p className="text-sm text-ink-muted mt-1">Delivery in about {cart.delivery_eta}</p>
        )}
        <p className="text-xs text-ink-muted leading-relaxed mt-3 pt-3 border-t border-ink/10">
          A Swiggy cart holds dishes from one restaurant. Adding a dish from somewhere else
          empties this cart first, and GlycoCart asks before doing that.
        </p>
      </section>

      <section aria-label={`${itemCount} ${itemCount === 1 ? "item" : "items"}`}>
        <ul className="card-solid divide-y divide-ink/10">
          {items.map((i) => {
            const lineBusy = busy === i.menu_item_id;
            const outOfStock = i.in_stock === false;
            return (
              <li key={i.menu_item_id} className="p-3 flex items-center gap-3">
                <CartThumb src={i.image_url} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words leading-snug">{i.name}</p>
                  {outOfStock && <p className="text-xs text-ember-text mt-0.5">Out of stock</p>}
                  {typeof i.price === "number" && (
                    <p className="text-sm tabular-nums text-ink-soft mt-0.5">
                      {formatINR(i.price)}
                      {typeof i.strikeout_price === "number" && (
                        <span className="ml-1.5 text-xs text-ink-muted line-through">
                          <span className="sr-only">was </span>
                          {formatINR(i.strikeout_price)}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {canEdit ? (
                  <div
                    className="flex items-center shrink-0 rounded-full border border-ink/10 bg-cream"
                    role="group"
                    aria-label={`Quantity of ${i.name}`}
                  >
                    <button
                      type="button"
                      onClick={() => setQuantity(i, i.quantity - 1)}
                      disabled={busy !== null}
                      className="size-11 inline-flex items-center justify-center rounded-full text-ink-soft hover:text-ink disabled:opacity-50"
                      aria-label={i.quantity <= 1 ? `Remove ${i.name}` : `One fewer ${i.name}`}
                    >
                      <Minus size={15} aria-hidden />
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums" aria-live="polite">
                      {lineBusy ? (
                        <Loader2 size={14} className="animate-spin mx-auto" aria-label="Updating" />
                      ) : (
                        i.quantity
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(i, i.quantity + 1)}
                      disabled={busy !== null || outOfStock}
                      className="size-11 inline-flex items-center justify-center rounded-full text-ink-soft hover:text-ink disabled:opacity-50"
                      aria-label={`One more ${i.name}`}
                    >
                      <Plus size={15} aria-hidden />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm tabular-nums text-ink-soft shrink-0">
                    <span className="sr-only">Quantity </span>&times;{i.quantity}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {actionError && (
          <p className="text-sm text-ember-text mt-2" role="alert">
            {actionError}
          </p>
        )}
      </section>

      {g && <GlucoseSummary g={g} />}

      {/* Pricing straight from Swiggy, never computed here */}
      {p && (
        <section className="card-solid p-4 text-sm" aria-labelledby="bill-heading">
          <h2 id="bill-heading" className="section-label mb-2">
            Bill from Swiggy
          </h2>
          <dl className="space-y-1.5">
            <Row label="Item total" value={p.item_total} />
            <Row label="Delivery" value={p.delivery_charge} />
            <Row label="Taxes and charges" value={p.taxes_and_charges} />
            {cart?.offers?.coupon_discount ? (
              <Row
                label={`Coupon${cart.offers.coupon_applied ? ` (${cart.offers.coupon_applied})` : ""}`}
                value={-cart.offers.coupon_discount}
              />
            ) : null}
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-ink/10 font-medium text-ink">
              <dt>To pay</dt>
              <dd className="tabular-nums">
                {typeof p.to_pay === "number" ? formatINR(p.to_pay) : "Shown in Swiggy"}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-ink-muted leading-relaxed mt-3">
            Swiggy sets these amounts. The final total, including any change in delivery
            fee, is confirmed in the Swiggy app.
          </p>
        </section>
      )}

      {/* The deliberate hand-off. See cart-tools.ts for why GlycoCart stops here. */}
      <section className="rounded-2xl border border-swiggy/40 bg-swiggy/10 p-4" aria-labelledby="checkout-heading">
        <h2 id="checkout-heading" className="font-medium text-ink">
          Finish checkout in Swiggy
        </h2>
        <p className="text-sm text-ink-soft leading-relaxed mt-1">
          GlycoCart will not place your order, because Swiggy orders cannot be cancelled
          from an app, only by calling Swiggy support. This is your real Swiggy cart, so
          you pay and place the order in Swiggy yourself.
        </p>
        <a
          href="https://www.swiggy.com/checkout"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-swiggy w-full mt-3 min-h-12"
        >
          Open Swiggy to check out <ExternalLink size={15} aria-hidden />
          <span className="sr-only">(opens Swiggy in a new tab)</span>
        </a>
        <p className="text-xs text-ink-soft leading-relaxed mt-3">
          Not seeing it in Swiggy? Carts are per address, so select the same delivery
          address in the Swiggy app.
        </p>
      </section>

      <div className="pt-2">
        {!confirmClear ? (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            disabled={busy !== null}
            className="inline-flex items-center min-h-11 px-4 rounded-full border border-ink/10 text-sm text-ember-text hover:bg-cream-deep transition-colors disabled:opacity-50"
          >
            Empty cart
          </button>
        ) : (
          <div className="card-solid p-4" role="group" aria-labelledby="clear-q" aria-describedby="clear-d">
            <p id="clear-q" className="font-medium text-sm">
              Empty this cart?
            </p>
            <p id="clear-d" className="text-sm text-ink-muted leading-relaxed mt-1">
              This removes every dish from your Swiggy cart, in the Swiggy app too.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={clearCart}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 min-h-11 px-4 rounded-full bg-ember text-on-accent text-sm font-medium disabled:opacity-60"
              >
                {busy === "clear" && <Loader2 size={14} className="animate-spin" aria-hidden />}
                Empty cart
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                disabled={busy === "clear"}
                autoFocus
                className="inline-flex items-center min-h-11 px-4 rounded-full border border-ink/10 text-sm text-ink-soft hover:text-ink"
              >
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The combined estimate. The server's `note` is written for the agent (it ends
 * in an instruction to the model), so the copy here is built from the counts.
 * When nothing in the cart was recognised, the totals would read as zero
 * carbs, which is an invented number, so they are not shown at all.
 */
function GlucoseSummary({ g }: { g: NonNullable<Cart["glucose"]> }) {
  const total = g.scored_items + g.unscored_items;

  return (
    <section className="card-solid p-4" aria-labelledby="glucose-heading">
      <h2 id="glucose-heading" className="section-label mb-3">
        Estimated glucose load
      </h2>

      {g.scored_items === 0 ? (
        <p className="text-sm text-ink-soft leading-relaxed">
          None of these dishes matched our food tables, so there is no estimate for this
          cart. Swiggy publishes no nutrition data, and GlycoCart does not guess.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2 text-center mb-3">
            <Stat label="carbs" value={`${g.total_carbs_g}g`} />
            <Stat label="kcal" value={`${g.total_calories}`} />
            <Stat
              label="top peak mg/dL"
              value={g.highest_single_item_peak_mg_dl ? `${g.highest_single_item_peak_mg_dl}` : "n/a"}
            />
          </dl>
          <p className="text-xs text-ink-muted leading-relaxed">
            Estimated from dish names, not measured.{" "}
            {g.unscored_items > 0 && (
              <span className="text-ink-soft">
                {g.unscored_items} of {total} {total === 1 ? "dish" : "dishes"} could not be
                estimated and {g.unscored_items === 1 ? "is" : "are"} left out of these totals.{" "}
              </span>
            )}
            The peak is the highest single dish, not the whole meal added up.
          </p>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cream py-2.5 px-1 rounded-lg flex flex-col-reverse">
      <dt className="text-xs text-ink-muted mt-1.5">{label}</dt>
      <dd className="text-base font-medium leading-none tabular-nums">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: number }) {
  if (typeof value !== "number") return null;
  return (
    <div className={cn("flex items-center justify-between", value < 0 ? "text-leaf-text" : "text-ink-soft")}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value < 0 ? `-${formatINR(-value)}` : formatINR(value)}</dd>
    </div>
  );
}
