/**
 * Verdict behaviour.
 *
 * Regression guard: verdicts used to be purely absolute (peak < 130 etc.), so a
 * user with a low fasting baseline and low carb sensitivity got "excellent" for
 * EVERY dish — pizza, biryani and dessert included. That is undiscriminating and
 * misleading in an app whose whole job is telling people what to avoid.
 *
 * Run: npm run test:glycemic
 */
import assert from "node:assert";
import { predictGlucoseResponse } from "./glycemic";
import type { UserProfile } from "./profile";
import type { Dish } from "./catalog";

const dish = (name: string, gl: number, carbs: number): Dish => ({
  id: name,
  name,
  description: "",
  cuisine: "test",
  price: 0,
  calories: 500,
  carbs,
  protein: 15,
  fat: 15,
  fiber: 3,
  gi: 60,
  gl,
  tags: [],
  veg: true
});

const profile = (fastingBaseline: number, insulinSensitivity: number): UserProfile => ({
  id: "t",
  displayName: "T",
  condition: "general",
  conditionLabel: "General metabolic health",
  goal: "maintain",
  dietary: [],
  blocklist: [],
  dailyCalTarget: 2000,
  metabolic: {
    fastingBaseline,
    insulinSensitivity,
    baselineAUC: Math.round(fastingBaseline * insulinSensitivity * 143),
    triggers: [],
    safeFoods: [],
    derivation: []
  },
  answers: {} as any,
  updatedAt: new Date().toISOString()
});

const PIZZA = dish("Pizza", 45.6, 76);
const DESSERT = dish("Gulab Jamun", 46.5, 62);
const GRILLED = dish("Chicken Tikka", 1.6, 8);
const DAL = dish("Dal Tadka", 10.2, 32);

// The exact profile that broke: low baseline, low sensitivity, no labs.
const lowBaseline = profile(88, 0.45);

const pizzaV = predictGlucoseResponse(PIZZA, lowBaseline).verdict;
const dessertV = predictGlucoseResponse(DESSERT, lowBaseline).verdict;
assert.notEqual(pizzaV, "excellent", "pizza must not be 'excellent' for a low-baseline user");
assert.notEqual(dessertV, "excellent", "dessert must never read 'excellent' in a glucose app");

// ...while genuinely benign food still rates well for the same user.
assert.equal(predictGlucoseResponse(GRILLED, lowBaseline).verdict, "excellent");
assert.equal(predictGlucoseResponse(DAL, lowBaseline).verdict, "excellent");

// Verdicts must actually discriminate — not all collapse to one value.
const spread = new Set(
  [PIZZA, DESSERT, GRILLED, DAL].map((d) => predictGlucoseResponse(d, lowBaseline).verdict)
);
assert.ok(spread.size >= 2, `verdicts should discriminate, got only: ${[...spread].join(",")}`);

// Higher-risk profiles must rate the same dish at least as harshly.
const order = ["excellent", "good", "moderate", "poor"];
const forT2D = predictGlucoseResponse(PIZZA, profile(126, 0.85)).verdict;
assert.ok(
  order.indexOf(forT2D) >= order.indexOf(pizzaV),
  "a higher-risk profile must never rate a dish more favourably"
);

// The absolute clinical ceiling still applies: crossing ADA's target can't be "excellent".
const highPeak = predictGlucoseResponse(dish("Sugar Bomb", 90, 120), profile(126, 0.85));
assert.ok(highPeak.peakMgDl > 165 && highPeak.verdict === "poor");

// REGRESSION — matchScore is what "Best for you" and the search results sort
// by. It only penalised peaks above 140 mg/dL, so for a user whose curve never
// reaches that, EVERY dish scored a flat 100 and the ranking was a no-op
// wearing a useful label. Scores must separate dishes across the normal range.
const scores = [GRILLED, DAL, PIZZA, DESSERT].map(
  (d) => predictGlucoseResponse(d, lowBaseline).matchScore
);
assert.equal(new Set(scores).size, 4, `matchScore must discriminate, got ${scores.join(",")}`);
assert.ok(
  scores[0] > scores[2] && scores[1] > scores[3],
  `grilled/dal must outrank pizza/dessert, got ${scores.join(",")}`
);
// And it must stay monotone: a bigger rise never scores better.
const byRise = [GRILLED, DAL, PIZZA, DESSERT]
  .map((d) => predictGlucoseResponse(d, lowBaseline))
  .sort((a, b) => a.peakMgDl - b.peakMgDl);
for (let i = 1; i < byRise.length; i++) {
  assert.ok(
    byRise[i].matchScore <= byRise[i - 1].matchScore,
    "a higher peak must never earn a higher match score"
  );
}

// A user's own baseline is the floor of their curve.
const p = predictGlucoseResponse(DAL, profile(126, 0.85));
assert.equal(p.curve[0].mgDl, 126, "curve must start at the user's fasting baseline");

console.log("glycemic: all checks passed");
