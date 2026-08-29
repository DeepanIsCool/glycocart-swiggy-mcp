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

/** `orderedItems` arrives as a human-readable summary string, not a list. */
export function splitOrderedItems(summary: unknown): string[] {
  if (typeof summary !== "string") return [];
  return summary
    .split(/,|\band\b|\|/i)
    .map((s) =>
      s
        .replace(/^\s*\d+\s*[xX×]\s*/, "")
        .replace(/\s*[xX×]\s*\d+\s*$/, "")
        .replace(/\(.*?\)/g, "")
        .trim()
    )
    .filter((s) => s.length > 2 && s.length < 60);
}

/** Retrospective estimate: what that past order probably did to their glucose. */
function scoreOrder(order: any, profile: UserProfile) {
  const names = splitOrderedItems(order?.orderedItems);
  let carbs = 0;
  let worstPeak = 0;
  let scored = 0;

  for (const name of names) {
    const est = estimateNutrition(name);
    if (!est) continue;
    scored += 1;
    carbs += est.carbs;
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
    items: names,
    glucose: scored
      ? {
          estimated_carbs_g: Math.round(carbs),
          highest_item_peak_mg_dl: worstPeak,
          items_scored: scored,
          items_unscored: names.length - scored
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
        addressId: z.string(),
        activeOnly: z.boolean().optional()
      }),
      execute: async ({ addressId, activeOnly }) => {
        const res = await callSwiggyRaw(client, "get_food_orders", { addressId, activeOnly });
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
