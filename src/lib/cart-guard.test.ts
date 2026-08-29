/**
 * The single-restaurant cart guard.
 *
 * Swiggy SILENTLY EMPTIES the cart when you add an item from a different
 * restaurant — no error, no warning. Verified live: a Burger King add wiped a
 * Food Peddler cart.
 *
 * The first version of this guard compared `restaurant.id`, but the cart
 * response only contains `{ name, deliverySubtitle }` — no id — so the check
 * silently never fired. The cart-safety suite passed the whole time because it
 * only asserted that no checkout tool existed; it never exercised this path.
 * Hence this test, against the real response shapes.
 *
 * Run: npm run test:cart-guard
 */
import assert from "node:assert";
import { buildCartTools } from "./cart-tools";
import type { UserProfile } from "./profile";

const profile: UserProfile = {
  id: "t",
  displayName: "T",
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

/** Minimal stand-in for the MCP client, returning real-shaped payloads. */
function fakeClient(cartPayload: unknown) {
  const calls: string[] = [];
  const client: any = {
    calls,
    async callTool({ name }: { name: string }) {
      calls.push(name);
      const body = name === "get_food_cart" ? cartPayload : { statusMessage: "CART_UPDATED_SUCCESSFULLY", data: {} };
      return { content: [{ type: "text", text: JSON.stringify(body) }], isError: false };
    }
  };
  return client;
}

// Real shape observed live: restaurant has a NAME but no id, and the cart
// payload is nested twice.
const cartWithFoodPeddler = {
  data: {
    data: {
      cart_id: 950587483,
      restaurant: { name: "Food Peddler Sandwiches", deliverySubtitle: "35-40 mins" },
      items: [{ menu_item_id: 50503674, name: "7 Veggie Sandwich", quantity: 1, final_price: 99 }],
      pricing: { item_total: 99, delivery_charge: 0, taxes_and_charges: 30, to_pay: 129 }
    },
    addressId: "addr-1"
  }
};

const emptyCart = { data: { data: { restaurant: null, items: [] }, addressId: "addr-1" } };

const ctx = { toolCallId: "t", messages: [] } as any;

async function main() {

// --- Adding from a DIFFERENT restaurant must be refused before the call -----
{
  const client = fakeClient(cartWithFoodPeddler);
  const tools = buildCartTools(client, profile);
  const res: any = await tools.update_food_cart.execute(
    {
      restaurantId: "999",
      restaurantName: "Burger King",
      addressId: "addr-1",
      cartItems: [{ menu_item_id: "1", quantity: 1 }]
    },
    ctx
  );
  assert.equal(res.conflict, "different_restaurant", "must refuse a cross-restaurant add");
  assert.match(res.current_restaurant, /Food Peddler/);
  assert.ok(
    !client.calls.includes("update_food_cart"),
    "must NOT call update_food_cart — Swiggy would silently wipe the cart"
  );
}

// --- Adding MORE from the SAME restaurant must go through ------------------
{
  const client = fakeClient(cartWithFoodPeddler);
  const tools = buildCartTools(client, profile);
  const res: any = await tools.update_food_cart.execute(
    {
      restaurantId: "123",
      restaurantName: "food peddler sandwiches", // case/whitespace must not matter
      addressId: "addr-1",
      cartItems: [{ menu_item_id: "2", quantity: 1 }]
    },
    ctx
  );
  assert.notEqual(res.conflict, "different_restaurant", "same restaurant must be allowed");
  assert.ok(client.calls.includes("update_food_cart"), "same-restaurant add should reach Swiggy");
}

// --- An empty cart accepts anything ---------------------------------------
{
  const client = fakeClient(emptyCart);
  const tools = buildCartTools(client, profile);
  const res: any = await tools.update_food_cart.execute(
    {
      restaurantId: "999",
      restaurantName: "Burger King",
      addressId: "addr-1",
      cartItems: [{ menu_item_id: "1", quantity: 1 }]
    },
    ctx
  );
  assert.notEqual(res.conflict, "different_restaurant", "empty cart must accept any restaurant");
}

// --- Pricing is passed through verbatim, never recomputed ------------------
{
  const client = fakeClient(cartWithFoodPeddler);
  const tools = buildCartTools(client, profile);
  const cart: any = await tools.get_food_cart.execute({ addressId: "addr-1" }, ctx);
  assert.equal(cart.pricing.to_pay, 129, "to_pay must come from Swiggy, not our arithmetic");
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].price, 99);
  // Double-nested payload must still resolve.
  assert.equal(cart.restaurant.name, "Food Peddler Sandwiches");
  assert.ok(cart.glucose.total_carbs_g > 0, "cart glucose load should be estimated");
}

  console.log("cart-guard: all checks passed");
}

main();
