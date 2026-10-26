/**
 * Safety gate: the agent must never be able to place a Swiggy order.
 *
 * Swiggy food orders are irreversible through the API — their own docs say to
 * phone customer care to cancel. So checkout is enforced by the tool simply not
 * existing, not by prompt wording a model can talk itself out of. If someone
 * later registers one of these, this fails loudly.
 *
 * Run: npm run test:cart-safety
 */
import assert from "node:assert";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const LIB = join(process.cwd(), "src/lib");

const FORBIDDEN = [
  "place_food_order",
  "confirm_order",
  "checkout",
  "get_payment_options",
  "check_payment_status",
  // Dineout: the live server exposes no cancel_booking, so a table booked here
  // could not be undone either.
  "book_table",
  "create_cart"
];

/**
 * Find every string passed as an MCP tool name, across all three servers.
 *
 * Matches any `callSomething(client, "tool_name")` helper rather than an
 * explicit list — adding a fourth server used to silently un-gate it, because
 * the old regex named Swiggy and Instamart only.
 */
function calledToolNames(source: string): string[] {
  const names: string[] = [];
  for (const re of [
    /call[A-Za-z]*\s*\(\s*client\s*,\s*["'`]([^"'`]+)["'`]/g,
    /callTool\s*\(\s*\{\s*name\s*:\s*["'`]([^"'`]+)["'`]/g
  ]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(source))) names.push(m[1]);
  }
  return names;
}

const sources = readdirSync(LIB)
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
  .map((f) => ({ file: f, text: readFileSync(join(LIB, f), "utf8") }));

const called = sources.flatMap((s) => calledToolNames(s.text).map((n) => ({ ...s, name: n })));
assert.ok(called.length > 0, "sanity: expected to find some MCP tool calls to inspect");

for (const { file, name } of called) {
  assert.ok(
    !FORBIDDEN.includes(name),
    `${file} calls the forbidden Swiggy tool "${name}" — GlycoCart must never place or pay for an order`
  );
}

// The tools the agent is offered must not be named after checkout either —
// checked across every tool-building module, not just the food cart.
for (const file of ["cart-tools.ts", "instamart-tools.ts", "swiggy-tools.ts", "dineout-tools.ts"]) {
  const text = readFileSync(join(LIB, file), "utf8");
  for (const bad of FORBIDDEN) {
    assert.ok(
      !new RegExp(`^\\s*${bad}\\s*:\\s*tool\\(`, "m").test(text),
      `${file} registers a forbidden tool: ${bad}`
    );
  }
}
const toolsFile = readFileSync(join(LIB, "cart-tools.ts"), "utf8");

// And the cart tools we DO expose must be present, or the feature is broken.
for (const required of ["get_food_cart", "update_food_cart", "flush_food_cart"]) {
  assert.ok(
    new RegExp(`^\\s*${required}\\s*:\\s*tool\\(`, "m").test(toolsFile),
    `cart-tools.ts is missing the expected tool: ${required}`
  );
}

// Any MCP call whose tool name is not a literal can be steered to a forbidden
// tool by its caller. The dev-only debug route did exactly that: its name came
// from the query string, so `?call=place_food_order` placed a real order. Every
// such call site under src/ must gate the name through isReadOnlyDebugTool.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });
}
for (const file of walk(join(process.cwd(), "src"))) {
  const text = readFileSync(file, "utf8");
  if (/callTool\s*\(\s*\{\s*name\s*:\s*[A-Za-z_$]/.test(text)) {
    assert.ok(
      text.includes("isReadOnlyDebugTool("),
      `${file} calls an MCP tool by a variable name without gating it through isReadOnlyDebugTool`
    );
  }
}

const { isReadOnlyDebugTool } = require("./debug-tools") as typeof import("./debug-tools");
for (const bad of [...FORBIDDEN, "update_food_cart", "flush_food_cart", "apply_food_coupon", "", undefined]) {
  assert.equal(isReadOnlyDebugTool(bad), false, `debug route must refuse ${String(bad)}`);
}
for (const ok of ["get_food_cart", "search_menu", "get_restaurant_menu", "your_go_to_items"]) {
  assert.equal(isReadOnlyDebugTool(ok), true, `debug route should allow read-only ${ok}`);
}

console.log("cart-safety: no checkout or payment tool is reachable by the agent");
