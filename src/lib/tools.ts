import type { Client } from "@modelcontextprotocol/client";
import type { UserProfile } from "./profile";
import { buildSwiggyTools } from "./swiggy-tools";

/**
 * The agent's toolset. Every user is signed in to their own Swiggy account,
 * so there is exactly one source of restaurant data: the live Swiggy Food MCP
 * server. There is deliberately no mock fallback — a user managing PCOS or
 * diabetes must never be shown invented restaurants as if they were real.
 */
export function buildToolset(profile: UserProfile, swiggyClient: Client) {
  return buildSwiggyTools(swiggyClient, profile);
}
