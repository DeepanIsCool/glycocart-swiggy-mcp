import { z } from "zod";
import { tool } from "ai";
import type { Client } from "@modelcontextprotocol/client";
import { callSwiggyRaw, unwrapSwiggy } from "./swiggy-tools";
import { predictGlucoseResponse } from "./glycemic";
import { estimateNutrition, dishFromEstimate } from "./nutrition-estimate";
import type { UserProfile } from "./profile";

/**
 * Order history and live tracking.
 *
 * Read-only: these tools look at orders the user placed themselves in Swiggy.
 * GlycoCart still cannot create one.
 */

/**
 * `orderedItems` arrives as a human-readable summary string, not a list, with
 * a count written either side of a name ("2 x Paneer Tikka", "Naan x3").
 */
export function parseOrderedItems(summary: unknown): { name: string; quantity: number }[] {
  if (typeof summary !== "string") return [];
  const out: { name: string; quantity: number }[] = [];
  for (const part of summary.split(/,|\band\b|\|/i)) {
    const lead = part.match(/^\s*(\d+)\s*[xX×]\s*/);
    const trail = part.match(/\s*[xX×]\s*(\d+)\s*$/);
    const name = part
      .replace(/^\s*\d+\s*[xX×]\s*/, "")
      .replace(/\s*[xX×]\s*\d+\s*$/, "")
      .replace(/\(.*?\)/g, "")
      .trim();
    if (name.length <= 2 || name.length >= 60) continue;
    const n = Number(lead?.[1] ?? trail?.[1] ?? 1);
    out.push({ name, quantity: Number.isInteger(n) && n >= 1 && n <= 50 ? n : 1 });
  }
  return out;
}

export function splitOrderedItems(summary: unknown): string[] {
  return parseOrderedItems(summary).map((i) => i.name);
}

/**
 * Retrospective estimate: what that past order probably did to their glucose.
 * Carbs count every unit: "3 x Butter Naan" was scored as one naan, so the
 * daily budget under-read exactly the orders that mattered most.
 */
function scoreOrder(order: any, profile: UserProfile) {
  const lines = parseOrderedItems(order?.orderedItems);
  let carbs = 0;
  let worstPeak = 0;
  let scored = 0;

  for (const { name, quantity } of lines) {
    const est = estimateNutrition(name);
    if (!est) continue;
    scored += 1;
    carbs += est.carbs * quantity;
    worstPeak = Math.max(worstPeak, predictGlucoseResponse(dishFromEstimate({ name }, est), profile).peakMgDl);
  }

  return {
    order_id: order?.orderId,
    restaurant: order?.restaurantName,
    area: order?.restaurantAreaName,
    total: order?.orderTotal,
    status: order?.orderStatus,
    delivery_status: order?.orderDeliveryStatus,
    is_active: Boolean(order?.isActiveOrder),
    ordered_at: order?.orderedTime,
    items: lines.map((l) => (l.quantity > 1 ? `${l.quantity} x ${l.name}` : l.name)),
    glucose: scored
      ? {
          estimated_carbs_g: Math.round(carbs),
          highest_item_peak_mg_dl: worstPeak,
          items_scored: scored,
          items_unscored: lines.length - scored
        }
      : null
  };
}

export function buildOrderTools(client: Client, profile: UserProfile) {
  return {
    get_food_orders: tool({
      description:
        "The user's Swiggy order history, each with a retrospective glucose estimate. Use for 'what have I been eating', spotting patterns, or checking an active delivery. Set activeOnly for current orders only.",
      parameters: z.object({
        addressId: z.string().optional().describe("defaults to the saved delivery address"),
        activeOnly: z.boolean().optional()
      }),
      execute: async ({ addressId, activeOnly }) => {
        const res = await callSwiggyRaw(client, "get_food_orders", {
          addressId: addressId ?? profile.defaultAddressId,
          activeOnly
        });
        if (res?.success === false) return res;
        const data = unwrapSwiggy<any>(res);
        const orders = (data?.orders ?? []).map((o: any) => scoreOrder(o, profile));
        return {
          orders,
          note:
            "Retrospective estimates from item names — Swiggy stores no nutrition. Useful for spotting patterns, not for precise numbers."
        };
      }
    }),

    track_food_order: tool({
      description: "Live status and ETA for an in-progress Swiggy order.",
      parameters: z.object({ orderId: z.string() }),
      execute: async ({ orderId }) => callSwiggyRaw(client, "track_food_order", { orderId })
    }),

    get_food_order_details: tool({
      description: "Full detail for one past Swiggy order.",
      parameters: z.object({ orderId: z.string() }),
      execute: async ({ orderId }) => callSwiggyRaw(client, "get_food_order_details", { orderId })
    })
  };
}
