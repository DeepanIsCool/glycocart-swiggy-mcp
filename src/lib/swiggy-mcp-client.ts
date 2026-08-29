import { cookies } from "next/headers";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { CookieOAuthProvider } from "./swiggy-oauth-provider";

export const SWIGGY_FOOD_MCP_URL = "https://mcp.swiggy.com/food";

export const SWIGGY_REDIRECT_URI = `${
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}/api/auth/swiggy/callback`;

/** Cheap, no-network check for whether a real Swiggy session cookie exists — safe to call from a Server Component. */
export async function hasSwiggySession(): Promise<boolean> {
  const jar = await cookies();
  return jar.has("swiggy_session");
}

/**
 * Connects to the real Swiggy Food MCP server using the current visitor's saved
 * tokens. Returns null (mock path) if the visitor never connected a real account
 * or the connection fails — callers should fall back to the mock catalog, never
 * throw the user out of the chat over a real-integration hiccup.
 */
export async function getSwiggyClient(): Promise<Client | null> {
  const provider = new CookieOAuthProvider(SWIGGY_REDIRECT_URI);
  const tokens = await provider.tokens();
  if (!tokens) return null;

  const client = new Client({ name: "glycocart", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(SWIGGY_FOOD_MCP_URL), {
    authProvider: provider,
    // Swiggy's auth-server metadata declares issuer "https://mcp.swiggy.com/auth" but is
    // discovered from "https://mcp.swiggy.com/food" (expected issuer "https://mcp.swiggy.com/") —
    // fails the SDK's RFC 8414 §3.3 anti-mix-up check. Confirmed via a real request (see
    // IssuerMismatchError). Low real risk here: single hardcoded first-party HTTPS domain, not
    // multi-tenant. Worth reporting to Swiggy (mcp-support@swiggy.in) to fix server-side.
    skipIssuerMetadataValidation: true
  });

  try {
    await client.connect(transport);
    return client;
  } catch (err) {
    console.error("Swiggy MCP connect failed", err);
    return null;
  }
}
