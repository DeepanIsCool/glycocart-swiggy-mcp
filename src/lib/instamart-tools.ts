import { z } from "zod";
import { tool } from "ai";
import type { Client } from "@modelcontextprotocol/client";
import { unwrapSwiggy } from "./swiggy-tools";
import { predictGlucoseResponse } from "./glycemic";
import { estimateNutrition, dishFromEstimate } from "./nutrition-estimate";
import { swiggyImageUrl } from "./swiggy-image";
import type { UserProfile } from "./profile";

/**
 * Swiggy Instamart (groceries).
 *
 * Strategically the most important surface for a metabolic-health product:
 * what's in someone's kitchen decides most of what they eat all week, whereas a
 * delivery order is one meal. Estimation is also stronger here — products carry
 * `brand` and `quantityDescription` ("500 g", "1 L"), so we can reason per pack
 * rather than guessing from a dish name alone.
 *
 * As with Food, checkout is NOT registered: `checkout`, `confirm_order` and the
 * payment tools are absent by design.
 */

async function callInstamart(client: Client, name: string, args: Record<string, unknown>) {
  const res = await client.callTool({ name, arguments: args });

  if (res.structuredContent !== undefined) return res.structuredContent as any;

  const first = (res.content as { type?: string; text?: string }[] | undefined)?.[0];
  let parsed: any;
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

/** "500 g", "1 kg", "1 L" -> grams where we can, so per-pack maths is possible. */
export function gramsFromQuantity(desc: unknown): number | null {
  if (typeof desc !== "string") return null;
  const m = desc.toLowerCase().match(/([\d.]+)\s*(kg|g|gm|gms|grams?|l|ml)\b/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!Number.isFinite(value)) return null;
  switch (m[2]) {
    case "kg":
      return value * 1000;
    case "l":
      return value * 1000; // treat 1 ml ≈ 1 g; fine for the staples this covers
    case "ml":
      return value;
    default:
      return value;
  }
}

function scoreProduct(product: any, variation: any, profile: UserProfile) {
  const name: string = variation?.displayName ?? product?.displayName ?? "";
  const brand: string = variation?.brandName ?? product?.brand ?? "";
  const quantity: string | undefined = variation?.quantityDescription;
  const grams = gramsFromQuantity(quantity);

  const base = {
    product_id: product?.productId,
    sku_id: variation?.skuId,
    spin_id: variation?.spinId,
    name,
    brand: brand || null,
    quantity: quantity ?? null,
    price: variation?.price?.offerPrice ?? variation?.price?.mrp ?? null,
    mrp: variation?.price?.mrp ?? null,
    image_url: swiggyImageUrl(variation?.imageUrl),
    in_stock: variation?.isInStockAndAvailable !== false && product?.inStock !== false,
    is_veg: variation?.vegClassifier ? /veg/i.test(variation.vegClassifier) && !/non/i.test(variation.vegClassifier) : undefined
  };

  // Estimate from the product name (brand words rarely help and often mislead).
  const est = estimateNutrition(name);
  if (!est) return { ...base, glycemic: null, note: "not scored — unrecognised product" };

  const pred = predictGlucoseResponse(dishFromEstimate({ name }, est), profile);
  return {
    ...base,
    glycemic: {
      // Per typical serving, as the composition tables are per serving.
      predicted_peak_mg_dl: pred.peakMgDl,
      verdict: pred.verdict,
      carbs_g_per_serving: est.carbs,
      fiber_g_per_serving: est.fiber,
      estimate_confidence: est.confidence,
      estimate_basis: est.basis,
      pack_grams: grams
    }
  };
}

export function buildInstamartTools(client: Client, profile: UserProfile) {
  return {
    search_products: tool({
      description:
        "Search Swiggy Instamart groceries, each scored for this user's predicted glucose response. Use for groceries, staples, snacks and weekly-shop questions — NOT for restaurant meals. Requires addressId.",
      parameters: z.object({
        addressId: z.string().describe("from the profile or get_addresses"),
        query: z.string().min(1).describe("product name, e.g. 'brown rice'"),
        offset: z.coerce.number().optional()
      }),
      execute: async ({ addressId, query, offset }) => {
        const res = await callInstamart(client, "search_products", { addressId, query, offset });
        if (res?.success === false) return res;

        const data = unwrapSwiggy<any>(res);
        const products: any[] = [];
        for (const p of data?.products ?? []) {
          for (const v of p?.variations ?? []) products.push(scoreProduct(p, v, profile));
        }
        products.sort(
          (a, b) => (b.glycemic ? 1 : 0) - (a.glycemic ? 1 : 0)
        );

        return {
          products: products.slice(0, 20),
          total: products.length,
          scoring_note:
            "Estimates from product names against Indian food composition tables, per typical serving — not per pack. Instamart labels are not read. Say 'estimated'."
        };
      }
    }),

    your_go_to_items: tool({
      description:
        "The user's frequently and recently ordered Instamart items. Use this to propose lower-GI swaps for what they ALREADY buy — the highest-value thing this app can do. Requires addressId.",
      parameters: z.object({ addressId: z.string() }),
      execute: async ({ addressId }) => {
        const res = await callInstamart(client, "your_go_to_items", { addressId });
        if (res?.success === false) return res;
        const data = unwrapSwiggy<any>(res);
        return {
          ...data,
          swap_note:
            "Suggest concrete lower-GI substitutions for these (white rice -> brown or millet, refined atta -> whole wheat). Only claim a swap is better if the estimate supports it."
        };
      }
    }),

    get_instamart_cart: tool({
      description: "View the user's current Instamart grocery cart.",
      parameters: z.object({}),
      execute: async () => callInstamart(client, "get_cart", {})
    }),

    update_instamart_cart: tool({
      description:
        "Add or change items in the Instamart cart. Quantity 0 removes. Confirm with the user before adding several items at once.",
      parameters: z.object({
        addressId: z.string(),
        items: z
          .array(z.object({ spinId: z.string(), quantity: z.coerce.number().min(0) }))
          .min(1)
      }),
      execute: async ({ addressId, items }) =>
        callInstamart(client, "update_cart", { addressId, items })
    }),

    list_instamart_coupons: tool({
      description: "List coupons available on the Instamart cart.",
      parameters: z.object({}),
      execute: async () => callInstamart(client, "list_coupons", {})
    })
  };
}
