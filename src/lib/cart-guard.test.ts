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
  const sent: any[] = [];
  const client: any = {
    calls,
    sent,
    async callTool({ name, arguments: args }: { name: string; arguments: any }) {
      calls.push(name);
      sent.push({ name, args });
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
  assert.equal(cart.items[0].price_line, 99);
  assert.equal(cart.items[0].price_each, 99, "quantity 1: the price is both per item and per line");
  assert.equal(cart.bill.to_pay, 129, "the bill's total is Swiggy's");
  assert.deepEqual(cart.bill.lines.map((l: any) => l.amount), [99, 0, 30], "every charge Swiggy sent is a line");
  // Double-nested payload must still resolve.
  assert.equal(cart.restaurant.name, "Food Peddler Sandwiches");
  assert.ok(cart.glucose.total_carbs_g > 0, "cart glucose load should be estimated");
}

// --- Adding a SECOND dish must not drop the first -------------------------
// Swiggy treats cartItems as the whole cart, not a delta. Sending only the new
// line replaced the existing one — seen live: adding a second momo silently
// removed the momo already in the cart.
{
  const client = fakeClient(cartWithFoodPeddler);
  const tools = buildCartTools(client, profile);
  await tools.update_food_cart.execute(
    {
      restaurantId: "123",
      restaurantName: "Food Peddler Sandwiches",
      addressId: "addr-1",
      cartItems: [{ menu_item_id: "2", quantity: 1 }]
    },
    ctx
  );
  const update = client.sent.find((c: any) => c.name === "update_food_cart");
  const ids = update.args.cartItems.map((i: any) => i.menu_item_id).sort();
  assert.deepEqual(
    ids,
    ["2", "50503674"],
    `adding an item must keep what was already in the cart, sent ${JSON.stringify(ids)}`
  );
}

// --- Quantity 0 removes that line, and keeps the others -------------------
{
  const twoItems = {
    data: {
      data: {
        restaurant: { name: "Food Peddler Sandwiches" },
        items: [
          { menu_item_id: 50503674, name: "7 Veggie Sandwich", quantity: 1 },
          { menu_item_id: 777, name: "Dal Tadka", quantity: 2 }
        ]
      }
    }
  };
  const client = fakeClient(twoItems);
  const tools = buildCartTools(client, profile);
  await tools.update_food_cart.execute(
    {
      restaurantId: "123",
      restaurantName: "Food Peddler Sandwiches",
      addressId: "addr-1",
      cartItems: [{ menu_item_id: "50503674", quantity: 0 }]
    },
    ctx
  );
  const update = client.sent.find((c: any) => c.name === "update_food_cart");
  assert.deepEqual(update.args.cartItems, [{ menu_item_id: "777", quantity: 2 }]);
}

// --- Removing the LAST line empties the cart rather than sending nothing ---
{
  const client = fakeClient(cartWithFoodPeddler);
  const tools = buildCartTools(client, profile);
  await tools.update_food_cart.execute(
    {
      restaurantId: "123",
      restaurantName: "Food Peddler Sandwiches",
      addressId: "addr-1",
      cartItems: [{ menu_item_id: "50503674", quantity: 0 }]
    },
    ctx
  );
  assert.ok(client.calls.includes("flush_food_cart"), "emptying the cart must use flush_food_cart");
  assert.ok(
    !client.calls.includes("update_food_cart"),
    "must not send update_food_cart with an empty item list"
  );
}

  // An Add button means one more. Sending quantity 1 used to REPLACE the
  // existing line, so a dish already in the cart at 2 dropped back to 1.
  {
    const client = fakeClient(cartWithFoodPeddler);
    const tools = buildCartTools(client, profile);
    const existing = (cartWithFoodPeddler as any).data.data.items[0];
    await tools.update_food_cart.execute(
      {
        restaurantId: "123",
        restaurantName: "Food Peddler Sandwiches",
        addressId: "addr-1",
        cartItems: [{ menu_item_id: String(existing.menu_item_id), quantity: 1 }],
        mode: "add"
      },
      ctx
    );
    const update = client.sent.find((c: any) => c.name === "update_food_cart");
    const line = update.args.cartItems.find((l: any) => l.menu_item_id === String(existing.menu_item_id));
    assert.equal(line.quantity, Number(existing.quantity) + 1, "add mode must increment, not reset");
  }

  // If the cart can't be read, the guard and the merge are blind, and an
  // update would replace whatever is in the cart. It must not write.
  {
    const client: any = {
      calls: [] as string[],
      async callTool({ name }: { name: string }) {
        client.calls.push(name);
        return { content: [{ type: "text", text: JSON.stringify({ error: { message: "upstream" } }) }], isError: true };
      }
    };
    const tools = buildCartTools(client, profile);
    const res: any = await tools.update_food_cart.execute(
      {
        restaurantId: "9",
        restaurantName: "Burger King",
        addressId: "addr-1",
        cartItems: [{ menu_item_id: "5", quantity: 1 }]
      },
      ctx
    );
    assert.equal(res?.success, false, "a failed cart read must be reported");
    assert.ok(!client.calls.includes("update_food_cart"), "must not write after a failed cart read");
  }

  // One cart address. Swiggy carts are per-address; the agent passing its own
  // address built a cart the Cart tab (which reads the default) couldn't see.
  {
    const client = fakeClient(cartWithFoodPeddler);
    const tools = buildCartTools(client, { ...profile, defaultAddressId: "home" });
    await tools.update_food_cart.execute(
      {
        restaurantId: "123",
        restaurantName: "Food Peddler Sandwiches",
        addressId: "somewhere-else",
        cartItems: [{ menu_item_id: "1", quantity: 1 }]
      },
      ctx
    );
    await tools.get_food_cart.execute({ addressId: "somewhere-else" }, ctx);
    const addresses = client.sent.map((c: any) => c.args.addressId).filter(Boolean);
    assert.ok(addresses.length > 0 && addresses.every((a: string) => a === "home"), `every call must use the default address: ${addresses}`);
  }

  // A cart built by the agent must be editable from the Cart tab: the
  // restaurant id is remembered on add and attached when the cart is read.
  {
    let saved: { id: string; name: string } | null = null;
    const memory = {
      remember: async (id: string, name: string) => void (saved = { id, name }),
      recall: async () => saved
    };
    const client = fakeClient(cartWithFoodPeddler);
    const tools = buildCartTools(client, profile, memory);
    const after: any = await tools.update_food_cart.execute(
      {
        restaurantId: "123",
        restaurantName: "Food Peddler Sandwiches",
        addressId: "addr-1",
        cartItems: [{ menu_item_id: "2", quantity: 1 }]
      },
      ctx
    );
    assert.deepEqual(saved, { id: "123", name: "Food Peddler Sandwiches" }, "the add is remembered");
    assert.equal(after.restaurant?.id, "123", "the update returns the cart with its restaurant id");
    assert.ok(Array.isArray(after.items) && after.items.length > 0, "the update returns the read-back cart, not a status");
    const read: any = await tools.get_food_cart.execute({ addressId: "addr-1" }, ctx);
    assert.equal(read.restaurant?.id, "123", "a later read carries the id too");
  }

  console.log("cart-guard: all checks passed");
}

main();
