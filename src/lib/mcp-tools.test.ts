/**
 * What the agent's tools do when Swiggy misbehaves, and which address they use.
 *
 * - A thrown MCP call (network drop, timeout, failed refresh) ended the whole
 *   chat reply with a stream error, because the AI SDK turns a throwing tool
 *   into one. Every call path now returns `{ success: false }` instead.
 * - Instamart had its own copy of the call helper that returned
 *   `structuredContent` even when `isError` was set: a failed call read as success.
 * - get_food_orders and search_dineout needed an address the model had to
 *   supply, so a call without one searched nowhere.
 * - Order quantities were dropped: "3 x Butter Naan" counted as one naan in
 *   the daily carb budget.
 *
 * - With no `sub` in the token, a second account signing in on the same
 *   browser inherited the first person's profile. Saved address ids decide.
 *
 * Run: npm run test:mcp-tools
 */
import assert from "node:assert";
import { buildToolset } from "./tools";
import { buildInstamartTools } from "./instamart-tools";
import { buildDineoutTools } from "./dineout-tools";
import { buildOrderTools, parseOrderedItems } from "./orders-tools";
import { estimateNutrition } from "./nutrition-estimate";
import { sameAccount } from "./account-match";
import type { UserProfile } from "./profile";

const profile: UserProfile = {
  id: "t",
  displayName: "T",
  defaultAddressId: "addr-home",
  condition: "general",
  conditionLabel: "General metabolic health",
  goal: "maintain",
  dietary: [],
  blocklist: [],
  dailyCalTarget: 2000,
  metabolic: {
    fastingBaseline: 88,
    insulinSensitivity: 0.45,
    baselineAUC: 5663,
    triggers: [],
    safeFoods: [],
    derivation: []
  },
  answers: {} as any,
  updatedAt: new Date().toISOString()
};

const opts = { toolCallId: "t", messages: [] } as any;

function client(respond: (name: string, args: any) => any) {
  const sent: { name: string; args: any }[] = [];
  return {
    sent,
    async callTool({ name, arguments: args }: { name: string; arguments: any }) {
      sent.push({ name, args });
      return respond(name, args);
    }
  } as any;
}

const text = (body: unknown) => ({ content: [{ type: "text", text: JSON.stringify(body) }], isError: false });

async function main() {
  // 1. A thrown call becomes a failure the model can explain, on every server.
  const throwing = client(() => {
    throw new Error("fetch failed\n    at stack line");
  });
  const tools: any = buildToolset(profile, throwing, throwing, throwing);
  for (const [name, args] of [
    ["search_menu", { addressId: "a", query: "dal" }],
    ["get_food_cart", {}],
    ["get_food_orders", {}],
    ["search_products", { addressId: "a", query: "rice" }],
    ["search_dineout", { query: "Italian" }]
  ] as const) {
    const out = await tools[name].execute(args, opts);
    assert.equal(out?.success, false, `${name} must report a thrown call as a failure, not throw`);
    assert.match(out.error.message, /fetch failed/, `${name} keeps the reason`);
    assert.ok(!out.error.message.includes("stack line"), `${name} does not leak a stack trace`);
  }

  // 2. A payload that breaks the shaping code is contained too.
  const odd = client(() => text({ orders: 5 }));
  const contained: any = buildToolset(profile, odd);
  const shaped = await contained.get_food_orders.execute({}, opts);
  assert.equal(shaped?.success, false, "a tool that throws while shaping returns a failure");

  // 3. Instamart: isError wins over structuredContent.
  const failingIm = client(() => ({
    isError: true,
    structuredContent: { products: [] },
    content: [{ type: "text", text: JSON.stringify({ error: { message: "Address not serviceable" } }) }]
  }));
  const im: any = buildInstamartTools(failingIm, profile);
  const imOut = await im.search_products.execute({ addressId: "a", query: "atta" }, opts);
  assert.equal(imOut?.success, false, "a failed Instamart call must not read as an empty success");
  assert.equal(imOut.error.message, "Address not serviceable");

  // 4. Orders and Dineout default to the saved address.
  const orders = client(() => text({ orders: [] }));
  await buildOrderTools(orders, profile).get_food_orders.execute({}, opts);
  assert.equal(orders.sent[0].args.addressId, "addr-home", "get_food_orders uses the saved address by default");

  const dine = client(() => ({ content: [{ type: "text", text: "No restaurants found." }], isError: false }));
  const dt: any = buildDineoutTools(dine, profile);
  await dt.search_dineout.execute({ query: "Italian" }, opts);
  assert.equal(dine.sent[0].args.addressId, "addr-home", "search_dineout searches near the saved address");
  await dt.search_dineout.execute({ query: "Italian", latitude: 12.9, longitude: 77.6 }, opts);
  assert.equal(dine.sent[1].args.addressId, undefined, "explicit coordinates are used as given");
  assert.equal(dine.sent[1].args.latitude, 12.9);

  // 5. Quantities count.
  assert.deepEqual(parseOrderedItems("3 x Butter Naan, Dal Tadka x2 and Jeera Rice"), [
    { name: "Butter Naan", quantity: 3 },
    { name: "Dal Tadka", quantity: 2 },
    { name: "Jeera Rice", quantity: 1 }
  ]);
  const naan = estimateNutrition("Butter Naan");
  assert.ok(naan, "sanity: Butter Naan is in the reference table");
  const one = client(() => text({ orders: [{ orderId: "1", orderedItems: "1 x Butter Naan" }] }));
  const three = client(() => text({ orders: [{ orderId: "2", orderedItems: "3 x Butter Naan" }] }));
  const c1: any = await buildOrderTools(one, profile).get_food_orders.execute({}, opts);
  const c3: any = await buildOrderTools(three, profile).get_food_orders.execute({}, opts);
  assert.equal(
    c3.orders[0].glucose.estimated_carbs_g,
    Math.round(naan!.carbs * 3),
    "three naan carry three naans of carbs"
  );
  assert.ok(c3.orders[0].glucose.estimated_carbs_g > c1.orders[0].glucose.estimated_carbs_g);
  assert.deepEqual(c3.orders[0].items, ["3 x Butter Naan"], "the count stays visible on the order");

  // 6. Same browser, which account?
  assert.equal(sameAccount(["a", "b"], ["b", "c"]), true, "a shared address id is the same account");
  assert.equal(sameAccount(["a", "b"], ["c"]), false, "no shared address id is a different account");
  assert.equal(sameAccount([], ["c"]), null, "nothing on file yet: can't tell");
  assert.equal(sameAccount(["a"], []), null, "no addresses on the account: can't tell");

  console.log("mcp-tools: all checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
