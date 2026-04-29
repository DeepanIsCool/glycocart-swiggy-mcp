import { z } from "zod";
import { tool } from "ai";
import { RESTAURANTS, getRestaurantWithMenu, getDish, type Dish } from "./catalog";
import { predictGlucoseResponse, rankDishesForUser, type GlucosePrediction } from "./glycemic";
import { PERSONAS, type PersonaId, type Persona } from "./personas";

/**
 * These tool schemas mirror the published Swiggy MCP signatures from
 * github.com/Swiggy/swiggy-mcp-server-manifest. In production, the handlers
 * are replaced with real MCP client calls — schemas stay identical.
 *
 * Mapping:
 *   search_restaurants  → swiggy-food.search
 *   get_restaurant_menu → swiggy-food.menu
 *   add_to_cart         → swiggy-food.cart.add
 *   place_order         → swiggy-food.order.place (COD only at MVP per Swiggy constraints)
 *
 * Swap path: in /api/chat/route.ts, replace `executeMockTool` with an MCP client
 * that proxies to https://mcp.swiggy.com/food once OAuth is granted.
 */

export function buildToolset(personaId: PersonaId) {
  const persona = PERSONAS[personaId];

  return {
    search_restaurants: tool({
      description:
        "Search Swiggy for restaurants near the user's saved address. Use when the user asks for food delivery options. Returns restaurants with cuisine, rating, ETA.",
      parameters: z.object({
        query: z.string().describe("cuisine, dish, or restaurant name (e.g. 'north indian', 'biryani')"),
        max_eta_min: z.coerce.number().optional().describe("max delivery time in minutes")
      }),
      execute: async ({ query, max_eta_min }) => {
        const q = query.toLowerCase();
        const results = RESTAURANTS.filter((r) => {
          const matchCuisine = r.cuisine.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q) || q.split(" ").some((w) => r.cuisine.toLowerCase().includes(w));
          const matchEta = !max_eta_min || r.deliveryMin <= max_eta_min;
          return matchCuisine && matchEta;
        });
        return {
          count: results.length,
          restaurants: results.map((r) => ({
            id: r.id, name: r.name, cuisine: r.cuisine, area: r.area,
            rating: r.rating, eta_min: r.deliveryMin, cost_for_two: r.costForTwo
          }))
        };
      }
    }),

    get_restaurant_menu: tool({
      description:
        "Get full menu of a restaurant by ID, with predicted glucose impact for each dish based on the user's metabolic profile. Use after search_restaurants.",
      parameters: z.object({
        restaurant_id: z.string()
      }),
      execute: async ({ restaurant_id }) => {
        const r = getRestaurantWithMenu(restaurant_id);
        const ranked = rankDishesForUser(r.menu, persona);
        return {
          restaurant: { id: r.id, name: r.name, cuisine: r.cuisine },
          menu: ranked.map((x) => ({
            id: x.dish.id, name: x.dish.name, description: x.dish.description, price: x.dish.price,
            calories: x.dish.calories, protein_g: x.dish.protein, carbs_g: x.dish.carbs, fiber_g: x.dish.fiber,
            predicted_peak_mg_dl: x.prediction.peakMgDl,
            predicted_auc: x.prediction.auc,
            match_score: x.overallScore,
            verdict: x.prediction.verdict,
            tags: x.dish.tags
          }))
        };
      }
    }),

    rank_dishes_for_user: tool({
      description:
        "Cross-restaurant: given a cuisine or budget, return the top dishes ranked by personal glycemic fit. Use this when the user just wants 'the best lunch option' without specifying a restaurant.",
      parameters: z.object({
        cuisine: z.string().optional(),
        max_calories: z.coerce.number().optional(),
        veg_only: z.coerce.boolean().optional(),
        limit: z.coerce.number().optional().default(5)
      }),
      execute: async ({ cuisine, max_calories, veg_only, limit }) => {
        let pool: Dish[] = [];
        for (const r of RESTAURANTS) {
          if (cuisine && !r.cuisine.toLowerCase().includes(cuisine.toLowerCase())) continue;
          pool.push(...r.dishIds.map(getDish));
        }
        if (max_calories) pool = pool.filter((d) => d.calories <= max_calories);
        if (veg_only) pool = pool.filter((d) => d.veg);

        const ranked = rankDishesForUser(pool, persona);
        return {
          recommendations: ranked.slice(0, limit ?? 5).map((x) => ({
            dish_id: x.dish.id,
            name: x.dish.name,
            cuisine: x.dish.cuisine,
            price: x.dish.price,
            calories: x.dish.calories,
            predicted_peak_mg_dl: x.prediction.peakMgDl,
            match_score: x.overallScore,
            verdict: x.prediction.verdict,
            why: buildExplanation(x.dish, persona, x.prediction)
          }))
        };
      }
    }),

    place_order: tool({
      description:
        "Place a Cash-on-Delivery order on Swiggy. Confirm with user before calling. Auto-logs the meal to the user's connected health app (Ultrahuman/Apple Health) on success.",
      parameters: z.object({
        dish_ids: z.array(z.string()).describe("dishes to order"),
        delivery_address: z.string().optional().describe("defaults to saved home address")
      }),
      execute: async ({ dish_ids, delivery_address }) => {
        const dishes = dish_ids.map(getDish);
        const total = dishes.reduce((s, d) => s + d.price, 0);
        const deliveryFee = 39;
        const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
        const eta = 28 + Math.floor(Math.random() * 12);

        // Compute combined glucose forecast for the meal
        const combinedDish: Dish = {
          ...dishes[0],
          calories: dishes.reduce((s, d) => s + d.calories, 0),
          carbs: dishes.reduce((s, d) => s + d.carbs, 0),
          protein: dishes.reduce((s, d) => s + d.protein, 0),
          fat: dishes.reduce((s, d) => s + d.fat, 0),
          fiber: dishes.reduce((s, d) => s + d.fiber, 0),
          gl: dishes.reduce((s, d) => s + d.gl, 0)
        };
        const forecast = predictGlucoseResponse(combinedDish, PERSONAS[personaId]);

        return {
          ok: true,
          order_id: orderId,
          payment: "COD",
          subtotal: total,
          delivery_fee: deliveryFee,
          total: total + deliveryFee,
          eta_min: eta,
          delivery_address: delivery_address ?? `Home — ${persona.city}`,
          predicted_glucose: {
            peak_mg_dl: forecast.peakMgDl,
            time_to_peak_min: forecast.timeToPeakMin,
            verdict: forecast.verdict
          },
          health_app_log: {
            synced_to: "Apple Health (mock)",
            entry_id: `meal_${orderId.toLowerCase()}`
          }
        };
      }
    })
  };
}

function buildExplanation(dish: Dish, persona: Persona, pred: GlucosePrediction): string {
  const reasons: string[] = [];
  if (dish.fiber >= 6) reasons.push(`${dish.fiber}g fiber dampens spike`);
  if (dish.protein >= 20) reasons.push(`${dish.protein}g protein slows absorption`);
  if (dish.gl < 15) reasons.push(`low glycemic load (${dish.gl.toFixed(1)})`);
  if (persona.metabolic.safeFoods.some((s) => dish.name.toLowerCase().includes(s.toLowerCase()))) {
    reasons.push("matches your historical safe foods");
  }
  if (pred.verdict === "excellent" || pred.verdict === "good") {
    reasons.push(`predicted peak ${pred.peakMgDl} mg/dL — under ADA target`);
  }
  return reasons.join("; ") || "balanced macros for your profile";
}
