/**
 * Self-check for the real-dish nutrition estimator.
 * Run: npm run test:nutrition
 */
import assert from "node:assert";
import { estimateNutrition } from "./nutrition-estimate";

// Catalog match wins over archetype, and carries real composition data.
const dal = estimateNutrition("Dal Tadka");
assert.ok(dal, "dal tadka should estimate");
assert.equal(dal.confidence, "matched");
assert.ok(dal.fiber >= 6, "dal should be high fiber");

// Real Swiggy names are messy — suffixes, portions, branding.
const biryani = estimateNutrition("Hyderabadi Chicken Biryani [Serves 2]");
assert.ok(biryani, "messy biryani name should still estimate");
assert.ok(biryani.gl > 30, `biryani should be high glycemic load, got ${biryani.gl}`);

// Archetype fallback for dishes absent from the catalog.
const gulab = estimateNutrition("Gulab Jamun (2 pcs)");
assert.ok(gulab, "dessert should hit an archetype");
assert.equal(gulab.confidence, "archetype");
assert.ok(gulab.gi >= 70, "dessert should be high GI");

// Description is used when the name alone is uninformative.
const combo = estimateNutrition("Chef's Special", "deep fried crispy chicken");
assert.ok(combo, "should fall back to description keywords");

// REGRESSION — the dangerous one. "Barbeque Chicken Pizza" used to match
// "Chicken Tikka" on the shared word "chicken", reporting a high-carb pizza as
// 4g carbs with no glucose rise. The dish TYPE must win over a shared topping.
const bbqPizza = estimateNutrition("Barbeque Chicken Pizza");
assert.ok(bbqPizza, "pizza should still estimate");
assert.ok(
  bbqPizza.carbs > 40,
  `pizza must be treated as high-carb, got ${bbqPizza.carbs}g (chicken-tikka mismatch has returned)`
);
for (const name of ["Chicken Burger", "Paneer Roll", "Chicken Hakka Noodles", "Egg Sandwich"]) {
  const e = estimateNutrition(name);
  assert.ok(e && e.carbs > 30, `${name} should be scored as a carb-bearing dish, got ${e?.carbs}g`);
}
// ...while genuinely low-carb grilled dishes stay low-carb.
const tikka = estimateNutrition("Chicken Tikka");
assert.ok(tikka && tikka.carbs < 15, `Chicken Tikka should stay low-carb, got ${tikka?.carbs}g`);

// Items seen in real Swiggy order history that used to come back unscored.
for (const name of ["Mini Waffle box of 4 - Premium Assorted", "Chicken Seekh Craver", "Veg Momo"]) {
  const e = estimateNutrition(name);
  assert.ok(e, `${name} should now be estimable — seen unscored in real order history`);
}
// A Subway "Craver" is a sub, not a skewer — it was scored as grilled protein
// at 8g carbs, hiding a whole bread roll from someone counting carbs.
const craver = estimateNutrition("Chicken Seekh Craver");
assert.ok(
  craver && craver.carbs > 30,
  `a Subway sub must count its bread, got ${craver?.carbs}g`
);

const waffle = estimateNutrition("Mini Waffle box of 4 - Premium Assorted");
assert.ok(waffle && waffle.gi >= 70, `waffle should score as a high-GI dessert, got GI ${waffle?.gi}`);

// REGRESSION — a whole restaurant menu reported identical macros. Live from
// Wow! Momo: three completely different foods all came back 450 kcal / 48g
// carbs, because a trailing word in the DESCRIPTION outranked the dish's own
// name ("Chicken Moburg", described as "Burger filled with … fried momos",
// scored as a momo). The name decides the dish type; the description is only a
// fallback.
const moburg = estimateNutrition(
  "Chicken Moburg",
  "Burger filled with crispy chicken fried momos and topped with red and green sauce and mayonnaise."
);
const steamMomo = estimateNutrition("Chicken Pahari Fresh Steam Momo");
const bigFries = estimateNutrition("OG Crispy Fries Large");
for (const [label, e] of [["Moburg", moburg], ["Steam Momo", steamMomo], ["Fries", bigFries]] as const) {
  assert.ok(e, `${label} should estimate`);
}
const macroKey = (e: typeof moburg) => `${e!.calories}/${e!.carbs}/${e!.protein}`;
assert.equal(
  new Set([macroKey(moburg), macroKey(steamMomo), macroKey(bigFries)]).size,
  3,
  `a burger, a steamed momo and fries must not share macros — got ${macroKey(moburg)}, ${macroKey(steamMomo)}, ${macroKey(bigFries)}`
);
// A burger is not butter chicken. "Chicken Moburg" matched the catalog entry
// "Butter Chicken" on a mid-name "chicken" and reported 14g carbs for a bun.
assert.ok(
  moburg!.carbs > 30,
  `a burger must be scored as high-carb, got ${moburg!.carbs}g (butter-chicken mismatch has returned)`
);
// ...and the head-noun rule must survive portion suffixes.
const servesTwo = estimateNutrition("Hyderabadi Chicken Biryani [Serves 2]");
assert.equal(servesTwo?.confidence, "matched", "a portion suffix must not break the catalog match");

// A steamed momo is a genuinely better choice than the deep-fried version, and
// must score that way rather than being lumped in with it.
const friedMomo = estimateNutrition("Kurkure Fried Momo");
assert.ok(friedMomo, "fried momo should estimate");
assert.ok(
  steamMomo!.protein > friedMomo!.protein && steamMomo!.calories < friedMomo!.calories,
  `steamed momo should beat fried on protein and calories, got steamed ${steamMomo!.calories}kcal/${steamMomo!.protein}g vs fried ${friedMomo!.calories}kcal/${friedMomo!.protein}g`
);

// The critical case: unknown dishes must return null, never invented numbers.
assert.equal(estimateNutrition("Zorbian Flarn Platter"), null);
assert.equal(estimateNutrition(""), null);

// Low-GI item should score better than a high-GI one for the same user.
const salad = estimateNutrition("Greek Salad with Feta");
assert.ok(salad && salad.gl < biryani.gl, "salad must be lower GL than biryani");

console.log("nutrition-estimate: all checks passed");
