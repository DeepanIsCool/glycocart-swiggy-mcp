/**
 * Onboarding's diet and avoid-list answers must reach the dishes shown.
 * The avoid list was saved and then ignored by every search.
 *
 * Run: npm run test:preferences
 */
import assert from "node:assert";
import { avoidMatches, dietConflict, preferenceRank, wantsVegOnly } from "./preferences";

const avoid = ["Deep fried", "White rice", "Maida", "Refined sugar", "Sugary drinks", "Excess dairy"];

assert.deepEqual(avoidMatches("Chicken Biryani", avoid), ["White rice"]);
assert.deepEqual(avoidMatches("Veg Samosa (2 pcs)", avoid), ["Deep fried", "Maida"]);
assert.deepEqual(avoidMatches("Butter Naan", avoid), ["Maida", "Excess dairy"]);
assert.deepEqual(avoidMatches("Gulab Jamun", avoid), ["Refined sugar"]);
assert.deepEqual(avoidMatches("Chocolate Milkshake", avoid), ["Sugary drinks", "Excess dairy"]);
assert.deepEqual(avoidMatches("Chicken 65", avoid), ["Deep fried"]);
// Things that must not be flagged.
assert.deepEqual(avoidMatches("Brown Rice Bowl", avoid), [], "brown rice is not white rice");
assert.deepEqual(avoidMatches("Veg Stir Fry", avoid), [], "a stir-fry is not deep fried");
assert.deepEqual(avoidMatches("Moong Dal Tadka", avoid), []);
assert.deepEqual(avoidMatches("Grilled Chicken Salad", avoid), []);
// A custom entry matches as text, case-insensitively.
assert.deepEqual(avoidMatches("Aloo Paratha", ["aloo"]), ["aloo"]);
assert.deepEqual(avoidMatches("Anything", []), []);

assert.equal(wantsVegOnly(["Vegetarian"]), true);
assert.equal(wantsVegOnly(["Jain", "Low carb"]), true);
assert.equal(wantsVegOnly(["Eggetarian"]), false, "Swiggy's veg flag can't separate egg from meat");
assert.equal(wantsVegOnly(["High protein"]), false);
assert.equal(dietConflict(false, ["Vegan"]), true);
assert.equal(dietConflict(undefined, ["Vegan"]), false, "unknown veg status is not a conflict");
assert.equal(dietConflict(false, []), false);

// A great score on the avoid list still ranks below a clean dish; unscored last.
{
  const dishes = [
    { name: "unscored", glycemic: null },
    { name: "fried, great score", glycemic: { match_score: 95 }, avoid_matches: ["Deep fried"] },
    { name: "clean, ok score", glycemic: { match_score: 60 }, avoid_matches: [] }
  ];
  const order = [...dishes].sort((a, b) => preferenceRank(b) - preferenceRank(a)).map((d) => d.name);
  assert.deepEqual(order, ["clean, ok score", "fried, great score", "unscored"]);
}

console.log("preferences: all checks passed");
