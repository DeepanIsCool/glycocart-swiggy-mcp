import { z } from "zod";
import { tool } from "ai";
import type { Client } from "@modelcontextprotocol/client";
import { predictGlucoseResponse } from "./glycemic";
import { estimateNutrition, dishFromEstimate } from "./nutrition-estimate";
import { swiggyImageUrl } from "./swiggy-image";
import type { UserProfile } from "./profile";

/**
 * Swiggy Dineout — table bookings.
 *
 * SAFETY: no booking, cart or payment tool is registered here. The published
 * reference lists `cancel_booking`, but the live server does NOT expose it —
 * verified by listing tools against the real endpoint. A booking we cannot
 * cancel is exactly the situation we refuse to create for food orders, so
 * GlycoCart finds the table and the person books it in Swiggy.
 *
 * Dineout also has no menu data at all: you get cuisines, not dishes. That is
 * the hardest case for someone managing glucose, so instead of pretending to
 * score a menu we give an ordering brief built from the user's OWN model
 * applied to representative dishes of the restaurant's cuisines.
 */

export interface DineoutRestaurant {
  id: string;
  name: string;
  cuisines: string[];
  rating?: number;
  rating_count?: number;
  cost_for_two?: string;
  area?: string;
  distance?: string;
  image_url?: string | null;
  highlights?: string[];
  offers?: string[];
}

/**
 * Dineout's search returns prose, not JSON — its structuredContent is empty.
 * The prose is strictly formatted, so parse it rather than throwing the data
 * away. Format, verified live:
 *   `2. Wok Street — Chinese, Asian | 4.3★ | ₹500 for two | New Alipore (ID: 79432)`
 */
export function parseDineoutLines(text: string): DineoutRestaurant[] {
  const out: DineoutRestaurant[] = [];
  for (const line of String(text ?? "").split("\n")) {
    const m = line.match(
      /^\s*\d+\.\s+(.+?)\s+—\s+(.+?)\s+\|\s+([\d.]+)★\s+\|\s+(.+?)\s+\|\s+(.+?)\s+\(ID:\s*(\w+)\)\s*$/
    );
    if (!m) continue;
    out.push({
      id: m[6],
      name: m[1].trim(),
      cuisines: m[2].split(",").map((c) => c.trim()).filter(Boolean),
      rating: Number(m[3]),
      cost_for_two: m[4].trim(),
      area: m[5].trim()
    });
  }
  return out;
}

/** Coordinates the search echoes back — every downstream Dineout call needs them. */
export function parseCoords(text: string): { latitude: number; longitude: number } | null {
  const lat = String(text ?? "").match(/latitude=(-?[\d.]+)/);
  const lng = String(text ?? "").match(/longitude=(-?[\d.]+)/);
  if (!lat || !lng) return null;
  return { latitude: Number(lat[1]), longitude: Number(lng[1]) };
}

/**
 * Representative dishes per cuisine, used to turn "this is a North Indian
 * place" into advice about what to order there. These are real dish names run
 * through the same estimator the rest of the app uses — no cuisine gets a
 * hand-written verdict, and any name the estimator cannot recognise is simply
 * dropped rather than guessed at.
 */
const CUISINE_DISHES: Record<string, string[]> = {
  "north indian": [
    "Dal Tadka", "Paneer Tikka", "Chicken Tikka", "Tandoori Chicken", "Palak Paneer",
    "Butter Naan", "Butter Chicken", "Chole Bhature", "Jeera Rice", "Rajma"
  ],
  mughlai: ["Chicken Tikka", "Tandoori Chicken", "Butter Chicken", "Hyderabadi Chicken Biryani", "Butter Naan"],
  biryani: ["Hyderabadi Chicken Biryani", "Chicken Tikka", "Cucumber Raita"],
  "south indian": ["Masala Dosa", "Idli Sambar", "Ragi Roti", "Foxtail Millet Khichdi", "Curd Rice"],
  chinese: ["Chicken Hakka Noodles", "Chilli Chicken", "Veg Fried Rice", "Chicken Manchurian", "Tofu Vegetable Stir-fry"],
  asian: ["Chicken Hakka Noodles", "Veg Fried Rice", "Tofu Vegetable Stir-fry", "Chicken Momo"],
  thai: ["Thai Green Curry", "Veg Fried Rice", "Tofu Vegetable Stir-fry"],
  momos: ["Chicken Momo", "Veg Momo", "Chicken Hakka Noodles"],
  italian: [
    "Margherita Pizza", "Chicken Alfredo Pasta", "Greek Salad with Feta", "Garlic Bread",
    "Grilled Chicken Steak", "Chocolate Brownie"
  ],
  continental: [
    "Grilled Chicken Steak", "Greek Salad with Feta", "Grilled Pomfret", "Garlic Bread",
    "French Fries", "Chicken Sandwich", "Chocolate Brownie"
  ],
  american: [
    "Chicken Burger", "French Fries", "Grilled Chicken Steak", "Greek Salad with Feta",
    "Margherita Pizza", "Chocolate Brownie"
  ],
  mexican: ["Chicken Burrito", "Veg Quesadilla", "Greek Salad with Feta", "Chicken Tikka", "French Fries"],
  bengali: ["Fish Curry", "Steamed Rice", "Dal Tadka", "Grilled Pomfret", "Gulab Jamun", "Egg Bhurji"],
  seafood: ["Grilled Pomfret", "Fish Curry", "Prawn Curry", "Steamed Rice", "Greek Salad with Feta", "French Fries"],
  cafe: [
    "Greek Salad with Feta", "Chicken Sandwich", "Garlic Bread", "Chocolate Brownie",
    "Cold Coffee", "Margherita Pizza"
  ],
  bakery: ["Chocolate Brownie", "Garlic Bread", "Chicken Sandwich", "Greek Salad with Feta"],
  beverages: ["Sweet Lassi", "Spiced Buttermilk", "Cold Coffee", "Chocolate Brownie"],
  desserts: ["Gulab Jamun", "Chocolate Brownie", "Gajar Halwa", "Sweet Lassi"],
  // Dineout labels a lot of places these; without them most cards get no brief.
  "multi cuisine": [
    "Dal Tadka", "Paneer Tikka", "Chicken Tikka", "Greek Salad with Feta", "Grilled Chicken Steak",
    "Butter Naan", "Hyderabadi Chicken Biryani", "Margherita Pizza", "Chicken Hakka Noodles"
  ],
  "finger food": ["Chicken Tikka", "French Fries", "Paneer Tikka", "Chilli Chicken", "Garlic Bread"],
  "fast food": ["Chicken Burger", "French Fries", "Margherita Pizza", "Chicken Momo", "Chicken Sandwich"],
  "street food": ["Chicken Momo", "Chole Bhature", "Masala Dosa", "French Fries", "Chicken Roll"],
  pizza: ["Margherita Pizza", "Garlic Bread", "Greek Salad with Feta", "Chicken Alfredo Pasta"],
  kebab: ["Chicken Tikka", "Tandoori Chicken", "Paneer Tikka", "Butter Naan", "Hyderabadi Chicken Biryani"],
  "healthy food": ["Greek Salad with Feta", "Quinoa Pulao", "Grilled Pomfret", "Oats Vegetable Khichdi", "Tofu Vegetable Stir-fry"],
  salad: ["Greek Salad with Feta", "Cucumber Raita", "Quinoa Pulao", "Grilled Chicken Steak"]
};

export interface CuisineBriefItem {
  name: string;
  peak_mg_dl: number;
  carbs_g: number;
  verdict: string;
}

export interface CuisineBrief {
  cuisines_used: string[];
  easier: CuisineBriefItem[];
  harder: CuisineBriefItem[];
  note: string;
}

/**
 * "You're eating out at a North Indian place — here's what tends to sit well
 * for YOU, and what tends not to." Scored with this user's own metabolic
 * model, so two people reading the same restaurant get different briefs.
 */
export function cuisineBrief(cuisines: string[], profile: UserProfile): CuisineBrief | null {
  const used: string[] = [];
  const names = new Set<string>();
  for (const c of cuisines) {
    const key = c.trim().toLowerCase();
    const dishes = CUISINE_DISHES[key];
    if (!dishes) continue;
    used.push(c.trim());
    for (const d of dishes) names.add(d);
  }
  if (names.size === 0) return null;

  const scored: CuisineBriefItem[] = [];
  for (const name of names) {
    const est = estimateNutrition(name);
    if (!est) continue; // never invent a dish we cannot estimate
    const pred = predictGlucoseResponse(dishFromEstimate({ name }, est), profile);
    scored.push({
      name,
      peak_mg_dl: pred.peakMgDl,
      carbs_g: est.carbs,
      verdict: pred.verdict
    });
  }
  if (scored.length < 2) return null;

  scored.sort((a, b) => a.peak_mg_dl - b.peak_mg_dl);

  // The two halves must not overlap. Naive slice(0,3) / slice(-3) on a short
  // list returned the SAME dishes as both "easier on you" and "hits hardest" —
  // caught live on a Continental restaurant with four scoreable dishes.
  const easierCount = Math.min(3, Math.floor(scored.length / 2));
  const easier = scored.slice(0, easierCount);
  const rest = scored.slice(easierCount);
  const harder = rest.slice(-Math.min(3, rest.length)).reverse();

  // And a spread of a few mg/dL is not a warning. Only call something "hardest"
  // when it is meaningfully worse than the easy end.
  const meaningful =
    harder.length > 0 && easier.length > 0 && harder[0].peak_mg_dl - easier[0].peak_mg_dl >= 15;

  return {
    cuisines_used: used,
    easier,
    harder: meaningful ? harder : [],
    note:
      "Dineout publishes no menu, so these are typical dishes for this restaurant's cuisines, estimated against your profile — not this kitchen's actual recipes."
  };
}

async function callDineout(client: Client, name: string, args: Record<string, unknown>) {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as { text?: string }[] | undefined)?.[0]?.text ?? "";
  if (res.isError) {
    return { success: false as const, error: { message: text || `${name} failed` } };
  }
  return { text, structured: res.structuredContent as any };
}

/**
 * Search, then enrich. Search gives prose for every hit; render gives rich JSON
 * for most of them (a couple of ids never resolve). Merging keeps every
 * restaurant and adds photos and offers wherever Swiggy has them.
 */
export async function dineoutSearch(
  client: Client,
  profile: UserProfile,
  query: string,
  location: { addressId?: string; latitude?: number; longitude?: number },
  opts: { limit?: number; offset?: number; withBriefs?: boolean } = {}
) {
  const res = await callDineout(client, "search_restaurants_dineout", {
    query,
    ...location,
    limit: opts.limit,
    offset: opts.offset
  });
  if ("success" in res) return res;

  const base = parseDineoutLines(res.text);
  const coords = parseCoords(res.text);
  if (base.length === 0) {
    return { restaurants: [], coords, message: "No Dineout restaurants matched that search." };
  }

  const rendered = await callDineout(client, "render_restaurants_dineout", {
    restaurantIds: base.map((r) => r.id),
    searches: [{ query, ...(coords ?? {}) }]
  });
  const rich: any[] = ("success" in rendered ? [] : rendered.structured?.restaurants) ?? [];
  const byId = new Map(rich.map((r) => [String(r.id), r]));

  const restaurants = base.map((r) => {
    const x = byId.get(r.id);
    return {
      ...r,
      cuisines: x?.cuisine ?? r.cuisines,
      area: x?.area ?? r.area,
      rating: x?.rating?.value ? Number(x.rating.value) : r.rating,
      rating_count: x?.rating?.count,
      cost_for_two: x?.costForTwo ?? r.cost_for_two,
      distance: x?.distance,
      image_url: swiggyImageUrl(x?.imageUrl),
      highlights: (x?.highlights ?? []).slice(0, 4),
      offers: (x?.offers ?? []).map((o: any) => o?.offerTitle).filter(Boolean).slice(0, 3),
      ...(opts.withBriefs ? { brief: cuisineBrief(x?.cuisine ?? r.cuisines, profile) } : {})
    };
  });

  return { restaurants, coords, more_available: /more available/.test(res.text) };
}

export function buildDineoutTools(client: Client, profile: UserProfile) {
  return {
    search_dineout: tool({
      description:
        "Find restaurants to BOOK A TABLE at (eating out, not delivery). Pass one term: a cuisine, restaurant name, area, or vibe like 'rooftop' or 'buffet'. Use the user's saved dineout addressId, or latitude/longitude for a named city.",
      parameters: z.object({
        query: z.string().min(1).describe("one term — 'Italian', 'rooftop', 'Toit' — not a sentence"),
        addressId: z.string().optional().describe("from get_dineout_locations, for 'near me'"),
        latitude: z.coerce.number().optional(),
        longitude: z.coerce.number().optional(),
        limit: z.coerce.number().min(1).max(30).optional()
      }),
      execute: async ({ query, addressId, latitude, longitude, limit }) => {
        const out = await dineoutSearch(
          client,
          profile,
          query,
          { addressId, latitude, longitude },
          { limit, withBriefs: true }
        );
        if ("success" in out) return out;
        return {
          ...out,
          booking_note:
            "GlycoCart does not book tables — the live Dineout server has no cancel tool, so a booking made here could not be undone. Tell the user to book in the Swiggy app.",
          render_note:
            "Cards are already shown with name, cuisine, rating, cost and offers. Don't relist them — say which suits this user and why."
        };
      }
    }),

    get_dineout_locations: tool({
      description: "The user's saved Dineout locations. Only needed for 'near me' searches.",
      parameters: z.object({}),
      execute: async () => callDineout(client, "get_saved_locations", {})
    }),

    get_dineout_restaurant: tool({
      description:
        "Full detail for one Dineout restaurant — timings, amenities, offers. Needs the same latitude/longitude the search used.",
      parameters: z.object({
        restaurantId: z.string(),
        latitude: z.coerce.number(),
        longitude: z.coerce.number()
      }),
      execute: async ({ restaurantId, latitude, longitude }) =>
        callDineout(client, "get_restaurant_details", { restaurantId, latitude, longitude })
    }),

    get_dineout_slots: tool({
      description:
        "Table availability for a Dineout restaurant on a date (YYYY-MM-DD). Read-only — showing slots does not reserve anything.",
      parameters: z.object({
        restaurantId: z.string(),
        date: z.string().describe("YYYY-MM-DD"),
        latitude: z.coerce.number(),
        longitude: z.coerce.number()
      }),
      execute: async ({ restaurantId, date, latitude, longitude }) =>
        callDineout(client, "get_available_slots", { restaurantId, date, latitude, longitude })
    })
  };
}
