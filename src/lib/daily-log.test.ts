/**
 * Daily carb allowance.
 * Run: npm run test:daily
 */
import assert from "node:assert";
import { softCarbCap, budgetSummary, type DailyBudget } from "./daily-log";
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
assert.match(empty, /Nothing logged today/);

console.log("daily-log: all checks passed");
