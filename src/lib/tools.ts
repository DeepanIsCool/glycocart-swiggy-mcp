import type { Client } from "@modelcontextprotocol/client";
import type { UserProfile } from "./profile";
import { buildSwiggyTools } from "./swiggy-tools";
import { buildCartTools } from "./cart-tools";
import { buildInstamartTools } from "./instamart-tools";
import { buildOrderTools } from "./orders-tools";
import { buildDineoutTools } from "./dineout-tools";

/**
 * The agent's toolset. Every user is signed in to their own Swiggy account,
 * so there is exactly one source of restaurant data: the live Swiggy Food MCP
 * server. There is deliberately no mock fallback — a user managing PCOS or
 * diabetes must never be shown invented restaurants as if they were real.
 */
export function buildToolset(
  profile: UserProfile,
  swiggyClient: Client,
  instamartClient?: Client | null,
  dineoutClient?: Client | null
) {
  return {
    ...buildSwiggyTools(swiggyClient, profile),
    ...buildCartTools(swiggyClient, profile),
    ...buildOrderTools(swiggyClient, profile),
    // Groceries and dining out are optional surfaces: if either server is
    // unreachable the agent simply doesn't get those tools rather than the
    // whole chat failing.
    ...(instamartClient ? buildInstamartTools(instamartClient, profile) : {}),
    ...(dineoutClient ? buildDineoutTools(dineoutClient, profile) : {})
  };
}

/**
 * Tools the agent must never have.
 *
 * Food: orders cannot be cancelled via the API, so checkout stays a human
 * action in the Swiggy app.
 *
 * Dineout: the published reference lists `cancel_booking`, but the LIVE server
 * does not expose it — confirmed by listing tools against the real endpoint. An
 * uncancellable booking is the same hazard as an uncancellable order, so
 * `book_table` and its cart/payment chain are excluded too.
 *
 * Asserted by a test — enforcement is the absence of the tool, not prompt
 * wording.
 */
export const FORBIDDEN_TOOLS = [
  "place_food_order",
  "confirm_order",
  "checkout",
  "get_payment_options",
  "check_payment_status",
  "book_table",
  "create_cart"
] as const;
