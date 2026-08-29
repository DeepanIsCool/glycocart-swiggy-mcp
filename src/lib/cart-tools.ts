import { z } from "zod";
import { tool } from "ai";
import type { Client } from "@modelcontextprotocol/client";
import { callSwiggyRaw, unwrapSwiggy } from "./swiggy-tools";
import { predictGlucoseResponse } from "./glycemic";
import { estimateNutrition, dishFromEstimate } from "./nutrition-estimate";
import type { UserProfile } from "./profile";

/**
 * Swiggy cart tools.
 *
 * DELIBERATELY EXCLUDES `place_food_order`, `confirm_order` and
 * `get_payment_options`. Swiggy food orders cannot be cancelled through the
 * API — their docs say to phone customer care — so GlycoCart builds the cart
 * and the user completes checkout in the Swiggy app. The agent cannot place an
 * order because the tool is not registered: this is enforced by absence, not
 * by asking the model nicely.
 */

export interface CartLine {
  menu_item_id: string;
  name: string;
  quantity: number;
  price?: number;
}

/** Combined estimated glucose load for everything in the cart. */
function summariseCartGlucose(items: any[], profile: UserProfile) {
  let scored = 0;
  let unscored = 0;
  let carbs = 0;
  let calories = 0;
  let worstPeak = 0;

  for (const line of items) {
    const qty = Number(line?.quantity) || 1;
    const est = estimateNutrition(String(line?.name ?? ""));
    if (!est) {
      unscored += 1;
      continue;
    }
    scored += 1;
    carbs += est.carbs * qty;
    calories += est.calories * qty;
    const pred = predictGlucoseResponse(
      dishFromEstimate({ name: String(line?.name ?? "") }, est),
      profile
    );
    worstPeak = Math.max(worstPeak, pred.peakMgDl);
  }

  return {
    scored_items: scored,
    unscored_items: unscored,
    total_carbs_g: Math.round(carbs),
    total_calories: Math.round(calories),
    highest_single_item_peak_mg_dl: worstPeak || null,
    note:
      unscored > 0
        ? `${unscored} item(s) could not be estimated and are excluded from these totals — say so.`
        : "Estimated from dish names, not measured. Peaks are per-item, not additive."
  };
}

function shapeCart(res: any, profile: UserProfile) {
  if (res?.success === false) return res;
  const data = unwrapSwiggy<any>(res);
  const items = data?.items ?? [];

  return {
    cart_id: data?.cart_id ?? null,
    restaurant: data?.restaurant ?? null,
    items: items.map((i: any) => ({
      menu_item_id: i.menu_item_id,
      name: i.name,
      quantity: i.quantity,
      price: i.final_price ?? i.total ?? i.subtotal
    })),
    // Pricing always comes from Swiggy — never computed here, because taxes and
    // delivery charges are theirs to determine.
    pricing: data?.pricing ?? null,
    offers: data?.offers ?? null,
    glucose: summariseCartGlucose(items, profile),
    checkout_note:
      "GlycoCart does not place orders. Once the cart is right, the user completes checkout in the Swiggy app — Swiggy orders cannot be cancelled via API, so we deliberately stop here."
  };
}

export function buildCartTools(client: Client, profile: UserProfile) {
  return {
    get_food_cart: tool({
      description:
        "Get the user's current Swiggy cart with real pricing and the combined estimated glucose load. Call before suggesting changes so you know what's already in it.",
      parameters: z.object({
        addressId: z.string().describe("required — delivery charges depend on it")
      }),
      execute: async ({ addressId }) =>
        shapeCart(await callSwiggyRaw(client, "get_food_cart", { addressId }), profile)
    }),

    update_food_cart: tool({
      description:
        "Add or change items in the Swiggy cart. A Swiggy cart belongs to ONE restaurant: if the cart already holds items from a different restaurantId, do NOT call this — tell the user and ask whether to clear the cart first. Quantity 0 removes an item.",
      parameters: z.object({
        restaurantId: z.string().describe("the restaurant these items belong to"),
        addressId: z.string().describe("from the user's profile or get_addresses"),
        restaurantName: z.string().describe("required — the cart guard compares by name, not id"),
        cartItems: z
          .array(
            z.object({
              menu_item_id: z.string(),
              quantity: z.coerce.number().min(0)
            })
          )
          .min(1)
      }),
      execute: async ({ restaurantId, addressId, restaurantName, cartItems }) => {
        // Guard the single-restaurant rule server-side. Swiggy silently WIPES the
        // cart when you add from another restaurant — verified live — so this
        // must be caught before the call, not reported after.
        //
        // Compare by NAME, not id: the cart response returns only
        // { name, deliverySubtitle } with no restaurant id, so an id comparison
        // silently never matched and the guard never fired.
        const current = unwrapSwiggy<any>(await callSwiggyRaw(client, "get_food_cart", { addressId }));
        const currentName: string | undefined = current?.restaurant?.name;
        const hasItems = (current?.items?.length ?? 0) > 0;
        const sameRestaurant =
          !currentName ||
          !restaurantName ||
          currentName.trim().toLowerCase() === restaurantName.trim().toLowerCase();

        if (hasItems && !sameRestaurant) {
          return {
            success: false,
            conflict: "different_restaurant",
            current_restaurant: currentName,
            message: `The cart already has items from ${currentName}. Swiggy carts hold one restaurant at a time, and adding from another silently empties it. Ask the user whether to discard that cart; only call flush_food_cart once they agree, then retry.`
          };
        }

        const res = await callSwiggyRaw(client, "update_food_cart", {
          restaurantId,
          addressId,
          restaurantName,
          cartItems
        });
        return shapeCart(res, profile);
      }
    }),

    flush_food_cart: tool({
      description: "Empty the Swiggy cart. Only call after the user has explicitly agreed to discard it.",
      parameters: z.object({}),
      execute: async () => callSwiggyRaw(client, "flush_food_cart", {})
    }),

    fetch_food_coupons: tool({
      description: "List coupons available for the current cart.",
      parameters: z.object({}),
      execute: async () => callSwiggyRaw(client, "fetch_food_coupons", {})
    }),

    apply_food_coupon: tool({
      description: "Apply a coupon code to the current cart, then report the new total.",
      parameters: z.object({ couponCode: z.string().min(1) }),
      execute: async ({ couponCode }) =>
        shapeCart(await callSwiggyRaw(client, "apply_food_coupon", { couponCode }), profile)
    })
  };
}
