/**
 * Swiggy's cart bill, as Swiggy states it.
 *
 * The Cart tab used to read four hard-coded keys (item_total, delivery_charge,
 * taxes_and_charges, to_pay). Any other charge Swiggy returned, such as
 * packaging, a platform fee or a discount, was dropped, so the rows shown didn't
 * add up to the total and the bill didn't match the Swiggy app. Swiggy's MCP
 * reference documents no bill schema, so this reads whatever it sends: every
 * numeric charge becomes a line, in Swiggy's order, and the total is found
 * under any of its common names. Nothing is computed except a consistency check.
 */

export interface BillLine {
  label: string;
  amount: number;
}

export interface Bill {
  lines: BillLine[];
  /** What Swiggy says is payable. Null when it sent no total. */
  to_pay: number | null;
  /** True when the lines don't sum to to_pay (within ₹1), so the UI can say the app is authoritative. */
  unbalanced: boolean;
}

const TOTAL_KEYS = /^(to_?pay|grand_?total|total_?(amount|payable|bill)?|net_?(payable|amount)|payable(_?amount)?|amount_?payable|final_?(amount|total))$/i;
const DISCOUNT = /discount|saving|coupon|offer|cashback|rebate/i;
// Not charges: ids, counts, flags and display-only fields that happen to be numbers.
const SKIP = /(^|_)(id|count|quantity|qty|percent|percentage|rate|version)$|^(id|count|is_?\w+)$/i;

const KNOWN_LABELS: Record<string, string> = {
  item_total: "Item total",
  items_total: "Item total",
  subtotal: "Item total",
  sub_total: "Item total",
  delivery_charge: "Delivery fee",
  delivery_fee: "Delivery fee",
  delivery_charges: "Delivery fee",
  taxes_and_charges: "Taxes and charges",
  taxes: "Taxes",
  gst: "GST",
  packing_charge: "Packaging",
  packing_charges: "Packaging",
  packaging_charge: "Packaging",
  packaging_charges: "Packaging",
  platform_fee: "Platform fee",
  convenience_fee: "Convenience fee",
  small_cart_fee: "Small cart fee",
  surge_fee: "Surge fee",
  tip: "Delivery tip",
  delivery_tip: "Delivery tip"
};

function snake(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

function label(key: string): string {
  const s = snake(key);
  if (KNOWN_LABELS[s]) return KNOWN_LABELS[s];
  const words = s.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function amountOf(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  // "₹129", "129.00", "1,299"
  if (typeof v === "string" && /^[₹\s]*-?[\d,]+(\.\d+)?$/.test(v.trim())) {
    const n = Number(v.replace(/[₹,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** A discount is money off: always shown negative, whichever sign Swiggy used. */
function signed(name: string, n: number): number {
  return DISCOUNT.test(name) ? -Math.abs(n) : n;
}

/** Breakdown arrays: [{ label|name|title|key, value|amount|price }]. */
function fromList(list: unknown[]): BillLine[] {
  const out: BillLine[] = [];
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    const o = e as Record<string, unknown>;
    const name = [o.label, o.name, o.title, o.key, o.type].find((x) => typeof x === "string") as string | undefined;
    const amt = amountOf(o.value ?? o.amount ?? o.price ?? o.total);
    if (name && amt !== null) out.push({ label: label(name), amount: signed(name, amt) });
  }
  return out;
}

export function normalizeBill(pricing: unknown): Bill | null {
  if (!pricing || typeof pricing !== "object") return null;
  const lines: BillLine[] = [];
  let toPay: number | null = null;

  if (Array.isArray(pricing)) {
    lines.push(...fromList(pricing));
  } else {
    for (const [key, value] of Object.entries(pricing as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        lines.push(...fromList(value));
        continue;
      }
      const amt = amountOf(value);
      if (amt === null) continue;
      if (TOTAL_KEYS.test(snake(key))) {
        // The first total wins; Swiggy may repeat it under another name.
        if (toPay === null) toPay = amt;
        continue;
      }
      if (SKIP.test(snake(key))) continue;
      lines.push({ label: label(key), amount: signed(key, amt) });
    }
  }

  // A list-style breakdown can carry the total as one of its lines.
  if (toPay === null) {
    const i = lines.findIndex((l) => TOTAL_KEYS.test(snake(l.label)) || /^(to pay|grand total|total)$/i.test(l.label));
    if (i >= 0) toPay = lines.splice(i, 1)[0].amount;
  }

  // The same charge under two names (Swiggy sometimes repeats item total).
  const seen = new Set<string>();
  const unique = lines.filter((l) => {
    const k = `${l.label}|${l.amount}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (unique.length === 0 && toPay === null) return null;
  const sum = unique.reduce((s, l) => s + l.amount, 0);
  return {
    lines: unique,
    to_pay: toPay,
    unbalanced: toPay !== null && unique.length > 0 && Math.abs(sum - toPay) > 1
  };
}

/**
 * Per-item and per-line price for a cart line, only when the two can be told
 * apart. Swiggy's item fields are undocumented: `final_price` was shown with a
 * strike-through `total`, which at quantity 2 read as a fake "was ₹198"
 * discount on a ₹99 dish.
 */
export function linePrice(item: { quantity?: unknown; final_price?: unknown; total?: unknown; subtotal?: unknown }): {
  each: number | null;
  line: number | null;
} {
  const qty = Number(item.quantity) || 1;
  const fp = amountOf(item.final_price);
  const total = amountOf(item.total) ?? amountOf(item.subtotal);
  if (fp !== null && total !== null) {
    if (Math.abs(fp * qty - total) <= 1) return { each: fp, line: total };
    if (Math.abs(fp - total) <= 1) return { each: qty > 1 ? null : fp, line: total };
    // Neither relation holds: a discount is in play. Swiggy's final price is
    // what's charged; which of the two is per item is unknowable here.
    return { each: null, line: qty === 1 ? fp : null };
  }
  const only = fp ?? total;
  return { each: qty === 1 ? only : null, line: qty === 1 ? only : null };
}
