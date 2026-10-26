/**
 * Daily carb allowance.
 * Run: npm run test:daily
 */
import assert from "node:assert";
import { softCarbCap, budgetSummary, budgetFromOrders, type DailyBudget } from "./daily-log";
import type { UserProfile } from "./profile";

const profile = (condition: UserProfile["condition"], dailyCalTarget: number): UserProfile => ({
  id: "t",
  displayName: "T",
  condition,
  conditionLabel: condition,
  goal: "maintain",
  dietary: [],
  blocklist: [],
  dailyCalTarget,
  metabolic: {
    fastingBaseline: 90,
    insulinSensitivity: 0.5,
    baselineAUC: 6435,
    triggers: [],
    safeFoods: [],
    derivation: []
  },
  answers: {} as any,
  updatedAt: new Date().toISOString()
});

// ~45% of calories from carbs at 4 kcal/g: 2000 kcal -> ~225g for a general profile.
const general = softCarbCap(profile("general", 2000));
assert.ok(Math.abs(general - 225) <= 5, `general cap should be ~225g, got ${general}`);

// Higher-risk conditions get a tighter allowance, and strictly so.
const preD = softCarbCap(profile("prediabetes", 2000));
const t2d = softCarbCap(profile("t2d", 2000));
assert.ok(preD < general, "prediabetes allowance must be below general");
assert.ok(t2d < preD, "type 2 diabetes allowance must be the tightest");

// The allowance follows the user's own calorie target, not a fixed number.
assert.ok(
  softCarbCap(profile("general", 2800)) > softCarbCap(profile("general", 1600)),
  "a larger calorie target must yield a larger carb allowance"
);

// Summary must always frame these as estimates, and must never tell someone to
// skip a meal — this text goes straight into the model's instructions.
const used: DailyBudget = {
  day: "2026-08-30",
  entries: [{ name: "Pizza", carbs: 76, peak: 130, at: "12:00" }],
  consumedCarbs: 76,
  softCapCarbs: 225,
  remainingCarbs: 149,
  usedFraction: 76 / 225
};
const text = budgetSummary(used);
assert.match(text, /estimate/i, "summary must say these are estimates");
assert.match(text, /never to tell someone to skip/i, "summary must forbid skip-a-meal advice");
assert.match(text, /Pizza/);
assert.match(text, /149g left/);

const empty = budgetSummary({ ...used, entries: [], consumedCarbs: 0, remainingCarbs: 225, usedFraction: 0 });
assert.match(empty, /No Swiggy food orders today/);
assert.match(empty, /don't assume they haven't eaten/, "an empty day must not read as an empty stomach");

// Today's budget comes from today's real orders, in Indian time.
{
  const p = profile("general", 2000);
  // 23:00 UTC on the 29th is 04:30 IST on the 30th.
  const now = new Date("2026-08-29T23:00:00Z");
  const orders = [
    // 00:30 IST on the 30th: today in India, though still the 29th in UTC.
    { ordered_at: "2026-08-30 00:30:00", status: "DELIVERED", restaurant: "Meghana", items: ["Biryani"], glucose: { estimated_carbs_g: 80, highest_item_peak_mg_dl: 160 } },
    // Yesterday in India.
    { ordered_at: "2026-08-29 21:00:00", status: "DELIVERED", items: ["Pizza"], glucose: { estimated_carbs_g: 90 } },
    // Cancelled orders weren't eaten.
    { ordered_at: "2026-08-30 01:00:00", status: "CANCELLED", items: ["Cake"], glucose: { estimated_carbs_g: 60 } },
    // Unscored: adds nothing rather than a guess.
    { ordered_at: "2026-08-30 02:00:00", status: "DELIVERED", items: ["Mystery"], glucose: null },
    // Unreadable time: left out.
    { ordered_at: "sometime", status: "DELIVERED", items: ["Dal"], glucose: { estimated_carbs_g: 30 } }
  ];
  const b = budgetFromOrders(orders, p, now);
  assert.equal(b.day, "2026-08-30", "the day is the IST day");
  assert.equal(b.consumedCarbs, 80);
  assert.equal(b.entries.length, 1);
  assert.match(b.entries[0].name, /Biryani from Meghana/);
  assert.match(budgetSummary(b), /Ordered on Swiggy today: Biryani from Meghana/);
}

console.log("daily-log: all checks passed");
