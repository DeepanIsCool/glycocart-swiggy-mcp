import { sqlClient, ensureSchemaReady } from "./db";
import type { UserProfile } from "./profile";

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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getBudget(uid: string, profile: UserProfile): Promise<DailyBudget> {
  await ensureSchemaReady();
  const sql = sqlClient();
  const day = today();
  const rows = (await sql`select entries from daily_log where user_id = ${uid} and day = ${day}`) as any[];
  const entries: LogEntry[] = rows[0]?.entries ?? [];

  const consumedCarbs = Math.round(entries.reduce((sum, e) => sum + (Number(e.carbs) || 0), 0));
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

export async function addEntries(uid: string, newEntries: LogEntry[]): Promise<void> {
  if (newEntries.length === 0) return;
  await ensureSchemaReady();
  const sql = sqlClient();
  const day = today();
  await sql`
    insert into daily_log (user_id, day, entries)
    values (${uid}, ${day}, ${JSON.stringify(newEntries)}::jsonb)
    on conflict (user_id, day) do update
      set entries = daily_log.entries || excluded.entries,
          updated_at = now()
  `;
}

/** One line for the system prompt, so advice accounts for the rest of the day. */
export function budgetSummary(b: DailyBudget): string {
  if (b.entries.length === 0) {
    return `Nothing logged today. Rough daily carb allowance ~${b.softCapCarbs}g (estimated from their calorie target).`;
  }
  const pct = Math.round(b.usedFraction * 100);
  return `Logged today: ${b.entries.map((e) => e.name).join(", ")}. Estimated ~${b.consumedCarbs}g carbs of a rough ~${b.softCapCarbs}g allowance (${pct}%), so about ${b.remainingCarbs}g left. These are estimates — use them to steer the next meal, never to tell someone to skip one.`;
}
