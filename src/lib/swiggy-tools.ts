import { z } from "zod";
import { tool } from "ai";
import type { Client } from "@modelcontextprotocol/client";
import { predictGlucoseResponse } from "./glycemic";
import { estimateNutrition, dishFromEstimate } from "./nutrition-estimate";
import type { UserProfile } from "./profile";

/**
 * Real Swiggy Food MCP tools. Schemas mirror the published reference at
 * mcp.swiggy.com/builders/docs/reference/food/ exactly — every tool except
 * get_addresses requires an addressId obtained from get_addresses first.
 */

/** Unwraps an MCP CallToolResult into the plain JSON Swiggy returns. */
export async function callSwiggyRaw(client: Client, name: string, args: Record<string, unknown>) {
  return callSwiggy(client, name, args);
}

async function callSwiggy(client: Client, name: string, args: Record<string, unknown>) {
  const res = await client.callTool({ name, arguments: args });

  if (res.structuredContent !== undefined) {
    return res.structuredContent as any;
  }

  const first = (res.content as { type?: string; text?: string }[] | undefined)?.[0];
  let parsed: any = undefined;
  if (first?.type === "text" && first.text) {
    try {
      parsed = JSON.parse(first.text);
    } catch {
      parsed = { raw: first.text };
    }
  }

  if (res.isError) {
    return { success: false, error: { message: parsed?.error?.message ?? parsed?.raw ?? `${name} failed` } };
  }
  return parsed ?? { success: false, error: { message: `${name} returned no content` } };
}

/** Adds a glucose forecast to a real menu item when we can estimate its macros. */
function scoreRealItem(
  item: { id?: string; name: string; description?: string; price?: number; isVeg?: boolean },
  profile: UserProfile
) {
  const est = estimateNutrition(item.name, item.description);
  if (!est) {
    return {
      id: item.id,
      name: item.name,
      price: item.price,
      is_veg: item.isVeg,
      glycemic: null,
      note: "no nutrition estimate available — not scored"
    };
  }
  const pred = predictGlucoseResponse(dishFromEstimate(item, est), profile);
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    is_veg: item.isVeg,
    glycemic: {
      predicted_peak_mg_dl: pred.peakMgDl,
      match_score: pred.matchScore,
      verdict: pred.verdict,
      calories: est.calories,
      carbs_g: est.carbs,
      protein_g: est.protein,
      fiber_g: est.fiber,
      estimate_confidence: est.confidence,
      estimate_basis: est.basis,
      // Sent so the UI can draw the curve without the browser ever holding
      // the user's metabolic profile.
      curve: pred.curve
    }
  };
}

export function buildSwiggyTools(client: Client, profile: UserProfile) {
  return {
    get_addresses: tool({
      description:
        "Get the user's saved Swiggy delivery addresses. You MUST call this first — every other Swiggy tool needs an addressId from here. Never invent an addressId.",
      parameters: z.object({
        page: z.coerce.number().optional(),
        pageSize: z.coerce.number().optional()
      }),
      execute: async ({ page, pageSize }) => callSwiggy(client, "get_addresses", { page, pageSize })
    }),

    search_restaurants: tool({
      description:
        "Search real Swiggy restaurants deliverable to one of the user's saved addresses. Requires addressId from get_addresses. Only recommend restaurants whose availabilityStatus is OPEN.",
      parameters: z.object({
        addressId: z.string().describe("from get_addresses — never guess this"),
        query: z.string().min(1).describe("restaurant name or cuisine, cannot be empty"),
        offset: z.coerce.number().optional()
      }),
      execute: async ({ addressId, query, offset }) =>
        callSwiggy(client, "search_restaurants", { addressId, query, offset })
    }),

    get_restaurant_menu: tool({
      description:
        "Get a real Swiggy restaurant's menu, with an estimated glucose forecast attached to each item where the dish is recognisable. Requires addressId and restaurantId.",
      parameters: z.object({
        addressId: z.string(),
        restaurantId: z.string(),
        page: z.coerce.number().optional(),
        pageSize: z.coerce.number().optional().describe("categories per page, max 8")
      }),
      execute: async ({ addressId, restaurantId, page, pageSize }) => {
        const res = await callSwiggy(client, "get_restaurant_menu", { addressId, restaurantId, page, pageSize });
        if (res?.success === false) return res;

        const data = res?.data ?? res;
        const categories = (data?.categories ?? []).map((cat: any) => ({
          title: cat.title,
          items: (cat.items ?? []).map((it: any) => scoreRealItem(it, profile))
        }));
        return {
          restaurant: {
            id: data?.id,
            name: data?.name,
            area: data?.areaName,
            rating: data?.avgRating,
            is_open: data?.isOpen,
            delivery_time: data?.deliveryTime
          },
          categories,
          has_more: data?.hasMore,
          scoring_note:
            "Glucose forecasts are ESTIMATES from dish-name matching against Indian food composition tables — Swiggy does not publish per-dish nutrition. Tell the user this, and treat 'archetype' confidence as a rough category average."
        };
      }
    }),

    search_menu: tool({
      description:
        "Search real dishes across Swiggy by name, each scored for this user's predicted glucose response where estimable. Use this for 'what should I eat' questions once you have an addressId.",
      parameters: z.object({
        addressId: z.string(),
        query: z.string().min(1).describe("dish name, e.g. 'biryani'"),
        vegFilter: z.union([z.literal(0), z.literal(1)]).optional().describe("1 = veg only"),
        offset: z.coerce.number().optional()
      }),
      execute: async ({ addressId, query, vegFilter, offset }) => {
        const res = await callSwiggy(client, "search_menu", { addressId, query, vegFilter, offset });
        if (res?.success === false) return res;

        const data = res?.data ?? res;
        const scored = (data?.items ?? []).map((it: any) =>
          scoreRealItem(
            {
              id: it.menu_item_id,
              name: it.name,
              price: it.price,
              isVeg: it.isVeg
            },
            profile
          )
        );

        // Best glycemic fit first; unscoreable items sink to the bottom.
        scored.sort(
          (a: any, b: any) => (b.glycemic?.match_score ?? -1) - (a.glycemic?.match_score ?? -1)
        );

        return {
          items: scored,
          total: data?.totalItems,
          has_more: data?.hasMore,
          scoring_note:
            "Glucose forecasts are ESTIMATES from dish-name matching against Indian food composition tables — Swiggy does not publish per-dish nutrition. Say so when presenting them. Items with glycemic:null could not be estimated; do not invent numbers for them."
        };
      }
    })
  };
}
