/**
 * The Cart tab's bill must show everything Swiggy charges. It read four fixed
 * keys, so packaging, platform fees and discounts vanished and the rows didn't
 * add up to the total shown in the Swiggy app.
 *
 * Run: npm run test:cart-bill
 */
import assert from "node:assert";
import { normalizeBill, linePrice } from "./cart-bill";

// The shape the app was built against still works.
{
  const b = normalizeBill({ item_total: 99, delivery_charge: 0, taxes_and_charges: 30, to_pay: 129 })!;
  assert.deepEqual(b.lines.map((l) => l.label), ["Item total", "Delivery fee", "Taxes and charges"]);
  assert.equal(b.to_pay, 129);
  assert.equal(b.unbalanced, false);
}

// Extra charges and a discount are shown, not dropped, so the rows add up.
{
  const b = normalizeBill({
    itemTotal: 398,
    deliveryFee: 35,
    packagingCharges: 20,
    platformFee: 10,
    gst: 21.5,
    couponDiscount: 80,
    toPay: 404.5
  })!;
  assert.deepEqual(
    b.lines.map((l) => [l.label, l.amount]),
    [["Item total", 398], ["Delivery fee", 35], ["Packaging", 20], ["Platform fee", 10], ["GST", 21.5], ["Coupon discount", -80]]
  );
  assert.equal(b.to_pay, 404.5);
  assert.equal(b.unbalanced, false, "with every line shown the bill balances");
}

// A list-style breakdown, total included as a line, amounts as strings.
{
  const b = normalizeBill({
    billBreakup: [
      { label: "Item Total", value: "₹250" },
      { label: "Delivery partner fee", value: "25" },
      { label: "Total", value: "275" }
    ]
  })!;
  assert.deepEqual(b.lines.map((l) => l.amount), [250, 25]);
  assert.equal(b.to_pay, 275);
}

// Ids and counts are not charges.
{
  const b = normalizeBill({ cart_id: 950587483, item_count: 2, item_total: 100, to_pay: 100 })!;
  assert.deepEqual(b.lines.map((l) => l.label), ["Item total"]);
}

// When Swiggy's own rows don't reach its total, say so instead of hiding it.
{
  const b = normalizeBill({ item_total: 100, to_pay: 140 })!;
  assert.equal(b.unbalanced, true);
}
assert.equal(normalizeBill(null), null);
assert.equal(normalizeBill({}), null);

// Line prices: per item and per line only when they can be told apart.
assert.deepEqual(linePrice({ quantity: 2, final_price: 99, total: 198 }), { each: 99, line: 198 });
assert.deepEqual(linePrice({ quantity: 1, final_price: 89, total: 99 }), { each: null, line: 89 }, "a discounted single item charges the final price");
assert.deepEqual(linePrice({ quantity: 2, final_price: 198, total: 198 }), { each: null, line: 198 });
assert.deepEqual(linePrice({ quantity: 1, final_price: 99 }), { each: 99, line: 99 });
assert.deepEqual(linePrice({ quantity: 3, final_price: 99 }), { each: null, line: null }, "one ambiguous number at qty 3 is not guessed");

console.log("cart-bill: all checks passed");
