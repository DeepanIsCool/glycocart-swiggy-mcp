"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, Trash2, ExternalLink, AlertTriangle, ShoppingBag, MapPin, UtensilsCrossed } from "lucide-react";
import { formatINR } from "@/lib/utils";

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

interface Cart {
  cart_id: string | null;
  restaurant: { id?: string; name?: string; area?: string } | null;
  delivering_to?: string | null;
  items: {
    menu_item_id: string;
    name: string;
    quantity: number;
    price?: number;
    strikeout_price?: number;
    image_url?: string | null;
  }[];
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

export function CartView() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/cart");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't load your cart.");
      setCart(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your cart.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function clearCart() {
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/cart", { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <Loader2 size={15} className="animate-spin" /> Loading your Swiggy cart…
      </p>
    );
  }

  if (error) return <p className="text-sm text-ember-text">{error}</p>;

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="card-solid p-8 text-center">
        <ShoppingBag size={28} className="mx-auto text-ink-muted mb-3" />
        <p className="font-medium mb-1">Your cart is empty</p>
        <p className="text-sm text-ink-muted leading-relaxed">
          Ask GlycoCart for something to eat, then add a dish from any result.
        </p>
      </div>
    );
  }

  const g = cart?.glucose;
  const p = cart?.pricing;

  return (
    <div className="space-y-4">
      {(cart?.restaurant?.name || cart?.delivering_to) && (
        <div className="card-solid p-4">
          {cart?.restaurant?.name && (
            <>
              <p className="mono text-ink-muted text-xs mb-1">from</p>
              <p className="font-medium">{cart.restaurant.name}</p>
            </>
          )}
          {/* A Swiggy cart belongs to one address. If the Swiggy app has a
              different address selected, this cart looks like it vanished — so
              name the address rather than leaving it a mystery. */}
          {cart?.delivering_to && (
            <p className="flex items-start gap-2 text-sm text-ink-muted leading-relaxed mt-1">
              <MapPin size={14} className="shrink-0 mt-0.5" />
              <span>{cart.delivering_to}</span>
            </p>
          )}
        </div>
      )}

      <div className="card-solid divide-y divide-ink/8">
        {items.map((i) => (
          <div key={i.menu_item_id} className="p-3 flex items-center gap-3">
            <CartThumb src={i.image_url} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium break-words leading-snug">{i.name}</p>
              <p className="text-xs text-ink-muted mt-0.5">Qty {i.quantity}</p>
            </div>
            {typeof i.price === "number" && (
              <p className="text-sm tabular-nums shrink-0 text-right">
                {formatINR(i.price)}
                {typeof i.strikeout_price === "number" && (
                  <span className="block text-xs text-ink-muted line-through">
                    {formatINR(i.strikeout_price)}
                  </span>
                )}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Estimated glucose load — the number no other food app shows */}
      {g && (
        <div className="card-solid p-4">
          <p className="mono text-ink-muted text-xs mb-3">estimated glucose load</p>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <Stat label="carbs" value={`${g.total_carbs_g}g`} />
            <Stat label="kcal" value={g.total_calories} />
            <Stat
              label="highest peak"
              value={g.highest_single_item_peak_mg_dl ? `${g.highest_single_item_peak_mg_dl}` : "—"}
            />
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">{g.note}</p>
        </div>
      )}

      {/* Pricing straight from Swiggy — never computed here */}
      {p && (
        <div className="card-solid p-4 space-y-1.5 text-sm">
          <Row label="Item total" value={p.item_total} />
          <Row label="Delivery" value={p.delivery_charge} />
          <Row label="Taxes and charges" value={p.taxes_and_charges} />
          {cart?.offers?.coupon_discount ? (
            <Row
              label={`Coupon${cart.offers.coupon_applied ? ` (${cart.offers.coupon_applied})` : ""}`}
              value={-cart.offers.coupon_discount}
            />
          ) : null}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-ink/8 font-medium">
            <span>To pay</span>
            <span className="tabular-nums">
              {typeof p.to_pay === "number" ? formatINR(p.to_pay) : "—"}
            </span>
          </div>
        </div>
      )}

      {/* Deliberate hand-off — see cart-tools.ts for why we stop here */}
      <div className="rounded-2xl border border-swiggy/30 bg-swiggy/10 p-4">
        <p className="flex items-start gap-2 text-sm text-ink-soft leading-relaxed">
          <AlertTriangle size={15} className="text-swiggy-text shrink-0 mt-0.5" />
          <span>
            This is a real cart on your Swiggy account, built through their API. GlycoCart
            doesn&apos;t place orders — Swiggy orders can&apos;t be cancelled from an app, only by
            calling their support, so you finish checkout in Swiggy yourself.{" "}
            <strong className="font-medium text-ink">
              If it doesn&apos;t appear in the Swiggy app, check that the app has the same delivery
              address selected
            </strong>{" "}
            — carts are per-address.
          </span>
        </p>
        <a
          href="https://www.swiggy.com/checkout"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-swiggy w-full mt-3 py-2.5 text-sm"
        >
          Open Swiggy to check out <ExternalLink size={14} />
        </a>
      </div>

      <button
        type="button"
        onClick={clearCart}
        disabled={busy}
        className="btn-ghost border border-ink/10 rounded-full disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} empty cart
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cream py-2.5 rounded-lg">
      <div className="text-base font-medium leading-none">{value}</div>
      <div className="mono text-ink-muted text-xs mt-1.5">{label}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: number }) {
  if (typeof value !== "number") return null;
  return (
    <div className="flex items-center justify-between text-ink-soft">
      <span>{label}</span>
      <span className="tabular-nums">{formatINR(value)}</span>
    </div>
  );
}
