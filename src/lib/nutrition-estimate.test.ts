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

// The critical case: unknown dishes must return null, never invented numbers.
assert.equal(estimateNutrition("Zorbian Flarn Platter"), null);
assert.equal(estimateNutrition(""), null);

// Low-GI item should score better than a high-GI one for the same user.
const salad = estimateNutrition("Greek Salad with Feta");
assert.ok(salad && salad.gl < biryani.gl, "salad must be lower GL than biryani");

console.log("nutrition-estimate: all checks passed");
