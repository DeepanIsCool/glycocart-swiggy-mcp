import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { CookieOAuthProvider } from "./swiggy-oauth-provider";
import { deriveUid } from "./crypto";

export const SWIGGY_FOOD_MCP_URL = "https://mcp.swiggy.com/food";
export const SWIGGY_INSTAMART_MCP_URL = "https://mcp.swiggy.com/instamart";

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
  return connectTo(SWIGGY_FOOD_MCP_URL);
}

/**
 * Instamart is a separate MCP server behind the same OAuth session. Connect
 * lazily and independently — a groceries outage must not break food search.
 */
export async function getInstamartClient(): Promise<Client | null> {
  return connectTo(SWIGGY_INSTAMART_MCP_URL);
}

async function connectTo(serverUrl: string): Promise<Client | null> {
  const provider = new CookieOAuthProvider(SWIGGY_REDIRECT_URI);
  const tokens = await provider.tokens();
  if (!tokens) return null;

  const client = new Client({ name: "glycocart", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(serverUrl), {
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
 * Resolve a stable, pseudonymous user id for the authenticated Swiggy account.
 *
 * The obvious key — the phone number on a saved address — does NOT work, and a
 * real account proved why: Swiggy masks the number (`****4257`) and returns a
 * DIFFERENT one per address, because addresses saved for friends carry their
 * number. Keying off `addresses[0]` would tie a profile to whichever address
 * happened to sort first, and lose it whenever that changed.
 *
 * Instead: prefer the `sub` claim of the OAuth access token, which is the
 * account identifier the authorization server itself issued. If the token
 * isn't a JWT, fall back to an id we mint and keep in our own session cookie —
 * stable per browser, which is honest about what we can actually guarantee.
 */
export async function resolveUid(existingUid: string | null): Promise<string> {
  if (existingUid) return existingUid;

  try {
    const provider = new CookieOAuthProvider(SWIGGY_REDIRECT_URI);
    const tokens = await provider.tokens();
    const sub = subjectFromJwt(tokens?.access_token);
    if (sub) return deriveUid(sub);
  } catch (err) {
    console.error("Could not read subject from access token", err);
  }

  return randomUUID();
}

/** Reads the `sub` claim without verifying — the token came from our own OAuth exchange. */
function subjectFromJwt(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const sub = payload?.sub ?? payload?.user_id ?? payload?.userId;
    return typeof sub === "string" && sub.trim() ? sub.trim() : null;
  } catch {
    return null;
  }
}
