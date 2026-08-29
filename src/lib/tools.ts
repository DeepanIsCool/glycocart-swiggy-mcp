import type { Client } from "@modelcontextprotocol/client";
import type { UserProfile } from "./profile";
import { buildSwiggyTools } from "./swiggy-tools";
import { buildCartTools } from "./cart-tools";

/**
 * The agent's toolset. Every user is signed in to their own Swiggy account,
 * so there is exactly one source of restaurant data: the live Swiggy Food MCP
 * server. There is deliberately no mock fallback — a user managing PCOS or
 * diabetes must never be shown invented restaurants as if they were real.
 */
export function buildToolset(profile: UserProfile, swiggyClient: Client) {
  return {
    ...buildSwiggyTools(swiggyClient, profile),
    ...buildCartTools(swiggyClient, profile)
  };
}

/**
 * Tools the agent must never have. Swiggy food orders cannot be cancelled via
 * the API, so checkout stays a human action in the Swiggy app. Asserted by a
 * test — enforcement is the absence of the tool, not prompt wording.
 */
export const FORBIDDEN_TOOLS = [
  "place_food_order",
  "confirm_order",
  "checkout",
  "get_payment_options",
  "check_payment_status"
] as const;
