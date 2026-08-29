import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { CookieOAuthProvider } from "./swiggy-oauth-provider";
import { deriveUid } from "./crypto";

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

/**
 * Resolve a stable, pseudonymous user id for the freshly-authenticated Swiggy
 * account by hashing the phone number on their saved address. We never store
 * the number itself — only the salted hash — so the profile row holds no
 * directly identifying data.
 *
 * Falls back to a random id when the account has no saved address (that user
 * cannot search Swiggy anyway until they add one; their profile still saves,
 * it just won't follow them to another device).
 */
export async function resolveUidFromSwiggy(client: Client): Promise<string> {
  try {
    const res = await client.callTool({ name: "get_addresses", arguments: {} });
    const first = (res.content as { type?: string; text?: string }[] | undefined)?.[0];
    const parsed =
      (res.structuredContent as any) ??
      (first?.type === "text" && first.text ? JSON.parse(first.text) : undefined);

    const phone = parsed?.data?.addresses?.[0]?.phoneNumber;
    if (typeof phone === "string" && phone.trim()) return deriveUid(phone.trim());
  } catch (err) {
    console.error("Could not resolve Swiggy identity from addresses", err);
  }
  return randomUUID();
}
