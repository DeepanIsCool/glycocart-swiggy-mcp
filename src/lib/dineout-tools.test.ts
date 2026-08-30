/**
 * Dineout returns prose, not JSON, so the parser is load-bearing: if it drifts,
 * the whole page silently renders zero restaurants.
 * Run: npm run test:dineout
 */
import assert from "node:assert";
import { parseDineoutLines, parseCoords, cuisineBrief } from "./dineout-tools";
import type { UserProfile } from "./profile";

// Verbatim from a live search_restaurants_dineout response.
const LIVE = `Found 30 restaurant(s) matching "Chinese", showing 10. 20 more available, call again with offset=10.
1. Cove - Community Bar — Italian, Chinese | 4.8★ | ₹2000 for two | Park Street (ID: 1318120)
2. Wok Street — Chinese, Asian | 4.3★ | ₹500 for two | New Alipore (ID: 79432)
3. Mainland China — Chinese, Asian | 4.4★ | ₹1600 for two | Jadavpur (ID: 19964)
Search coordinates: latitude=22.5038422, longitude=88.3323262 (use these for get_restaurant_details and downstream calls).

When the user selects a restaurant, call get_restaurant_details.`;

const rows = parseDineoutLines(LIVE);
assert.equal(rows.length, 3, `expected 3 restaurants, got ${rows.length}`);
assert.deepEqual(rows[1], {
  id: "79432",
  name: "Wok Street",
  cuisines: ["Chinese", "Asian"],
  rating: 4.3,
  cost_for_two: "₹500 for two",
  area: "New Alipore"
});
// A name containing a dash must not be split on it — only the em dash separates.
assert.equal(rows[0].name, "Cove - Community Bar");

// Prose lines that aren't restaurants must never become restaurants.
assert.equal(parseDineoutLines("no results here").length, 0);
assert.equal(parseDineoutLines("").length, 0);

assert.deepEqual(parseCoords(LIVE), { latitude: 22.5038422, longitude: 88.3323262 });
assert.equal(parseCoords("nothing"), null);

const profile: UserProfile = {
  id: "t",
  displayName: "T",
  condition: "t2d",
  conditionLabel: "Type 2 diabetes",
  goal: "maintain",
  dietary: [],
  blocklist: [],
  dailyCalTarget: 2000,
  metabolic: {
    fastingBaseline: 110,
    insulinSensitivity: 0.8,
    baselineAUC: 12584,
    triggers: [],
    safeFoods: [],
    derivation: []
  },
  answers: {} as any,
  updatedAt: new Date().toISOString()
};

const brief = cuisineBrief(["North Indian", "Mughlai"], profile);
assert.ok(brief, "north indian should produce an ordering brief");
assert.ok(brief.easier.length > 0 && brief.harder.length > 0);
// The whole point: the easier picks must actually be easier for this person.
assert.ok(
  brief.easier[0].peak_mg_dl < brief.harder[0].peak_mg_dl,
  `easier pick (${brief.easier[0].name} ${brief.easier[0].peak_mg_dl}) must peak below the harder one (${brief.harder[0].name} ${brief.harder[0].peak_mg_dl})`
);
// Every dish named must have come from the estimator, never invented.
for (const item of [...brief.easier, ...brief.harder]) {
  assert.ok(item.carbs_g > 0 || item.peak_mg_dl > 0, `${item.name} has no real numbers behind it`);
}

// REGRESSION — caught live on a Continental restaurant. A short dish list made
// slice(0,3) and slice(-3) overlap, so the SAME three dishes were listed as both
// "easier on you" and "hits hardest". The two halves must be disjoint for every
// cuisine we know about, however few dishes it has.
for (const cuisine of ["Continental", "Seafood", "Desserts", "Salad", "Bakery", "Italian", "Multi Cuisine"]) {
  const b = cuisineBrief([cuisine], profile);
  if (!b) continue;
  const easyNames = new Set(b.easier.map((i) => i.name));
  for (const h of b.harder) {
    assert.ok(!easyNames.has(h.name), `${cuisine}: "${h.name}" is listed as both easier and harder`);
  }
  // And nothing is called "hardest" over a trivial difference.
  if (b.harder.length > 0) {
    assert.ok(
      b.harder[0].peak_mg_dl - b.easier[0].peak_mg_dl >= 15,
      `${cuisine}: flagged a ${b.harder[0].peak_mg_dl - b.easier[0].peak_mg_dl} mg/dL spread as "hits hardest"`
    );
  }
}

// An unknown cuisine gets no brief rather than a made-up one.
assert.equal(cuisineBrief(["Klingon"], profile), null);
assert.equal(cuisineBrief([], profile), null);

console.log("dineout-tools: all checks passed");
