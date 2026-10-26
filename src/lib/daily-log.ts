import type { UserProfile } from "./profile";
import { istDay, parseOrderedAt } from "./order-time";

/**
 * Daily glucose budget.
 *
 * Advice that ignores what someone already ate today is advice about a
 * stranger. This tracks estimated carb load per day so the afternoon
 * recommendation knows about lunch.
 *
 * Everything here is an ESTIMATE built on other estimates — dish-name matching
 * feeding a heuristic model — so it is presented as a rough running total, not
 * a measurement, and never as a reason to skip a meal.
 */

export interface LogEntry {
  name: string;
  carbs: number;
  peak: number;
  at: string;
}

export interface DailyBudget {
  day: string;
  entries: LogEntry[];
  consumedCarbs: number;
  softCapCarbs: number;
  remainingCarbs: number;
  usedFraction: number;
}

/**
 * A day's carb allowance, derived from the user's own calorie target rather
 * than a population default: ~45% of calories from carbohydrate is the middle
 * of the accepted range, at 4 kcal per gram.
 */
export function softCarbCap(profile: UserProfile): number {
  const fromCalories = (profile.dailyCalTarget * 0.45) / 4;
  // Lower-carb targets for insulin-resistant and diabetic profiles.
  const factor =
    profile.condition === "t2d" ? 0.7 : profile.condition === "pcos_ir" || profile.condition === "prediabetes" ? 0.8 : 1;
  return Math.round((fromCalories * factor) / 5) * 5;
}

/**
 * Today's budget from the person's actual Swiggy orders.
 *
 * Nothing ever wrote the daily log (GlycoCart places no orders, so it never
 * knew what was eaten), and "today so far" was always empty. Today's orders,
 * already scored by get_food_orders, are the real record. The day is the
 * Indian calendar day, not UTC, which rolled over at 05:30. Cancelled orders
 * and orders whose time can't be read are left out; unscored items add
 * nothing rather than a guess.
 */
export function budgetFromOrders(orders: any[], profile: UserProfile, now: Date = new Date()): DailyBudget {
  const day = istDay(now);
  const entries: LogEntry[] = [];
  for (const o of orders ?? []) {
    if (/cancel/i.test(String(o?.status ?? ""))) continue;
    const at = parseOrderedAt(o?.ordered_at);
    if (!at || istDay(at) !== day) continue;
    const carbs = Number(o?.glucose?.estimated_carbs_g);
    if (!Number.isFinite(carbs) || carbs <= 0) continue;
    const items = Array.isArray(o?.items) && o.items.length ? o.items.join(", ") : "an order";
    entries.push({
      name: o?.restaurant ? `${items} from ${o.restaurant}` : items,
      carbs,
      peak: Number(o?.glucose?.highest_item_peak_mg_dl) || 0,
      at: at.toISOString()
    });
  }
  const consumedCarbs = Math.round(entries.reduce((sum, e) => sum + e.carbs, 0));
  const softCapCarbs = softCarbCap(profile);
  return {
    day,
    entries,
    consumedCarbs,
    softCapCarbs,
    remainingCarbs: Math.max(0, softCapCarbs - consumedCarbs),
    usedFraction: softCapCarbs > 0 ? consumedCarbs / softCapCarbs : 0
  };
}

/** One line for the system prompt, so advice accounts for the rest of the day. */
export function budgetSummary(b: DailyBudget): string {
  if (b.entries.length === 0) {
    return `No Swiggy food orders today that could be estimated. Meals from elsewhere are unknown, so don't assume they haven't eaten. Rough daily carb allowance ~${b.softCapCarbs}g (estimated from their calorie target).`;
  }
  const pct = Math.round(b.usedFraction * 100);
  return `Ordered on Swiggy today: ${b.entries.map((e) => e.name).join("; ")}. Estimated ~${b.consumedCarbs}g carbs of a rough ~${b.softCapCarbs}g allowance (${pct}%), so about ${b.remainingCarbs}g left. These are estimates — use them to steer the next meal, never to tell someone to skip one.`;
}
