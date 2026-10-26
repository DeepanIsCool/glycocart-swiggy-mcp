/**
 * Which Swiggy tools the dev-only /api/debug/swiggy-tools route may call.
 *
 * That route takes the tool name from the query string. It used to call any
 * name, so `?call=place_food_order` in `next dev` (or any non-production
 * deploy) placed a real, uncancellable order on the signed-in account. It
 * exists to inspect response shapes, so it gets read-only tools and nothing
 * that writes.
 */

const READ_ONLY_PREFIXES = ["get_", "search_", "list_", "fetch_", "track_"];
const READ_ONLY_NAMES = new Set(["your_go_to_items"]);

/** Never callable from anywhere, whatever its prefix. Mirrors FORBIDDEN_TOOLS in tools.ts. */
const NEVER = new Set([
  "place_food_order",
  "confirm_order",
  "checkout",
  "get_payment_options",
  "check_payment_status",
  "book_table",
  "create_cart"
]);

export function isReadOnlyDebugTool(name: unknown): name is string {
  if (typeof name !== "string" || !name) return false;
  if (NEVER.has(name)) return false;
  return READ_ONLY_NAMES.has(name) || READ_ONLY_PREFIXES.some((p) => name.startsWith(p));
}
