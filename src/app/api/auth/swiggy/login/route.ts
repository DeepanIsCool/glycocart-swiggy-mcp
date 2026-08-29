import { NextResponse } from "next/server";
import { auth } from "@modelcontextprotocol/client";
import { CookieOAuthProvider } from "@/lib/swiggy-oauth-provider";
import { SWIGGY_FOOD_MCP_URL, SWIGGY_REDIRECT_URI } from "@/lib/swiggy-mcp-client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const provider = new CookieOAuthProvider(SWIGGY_REDIRECT_URI);

  let result: "AUTHORIZED" | "REDIRECT";
  try {
    // See swiggy-mcp-client.ts: Swiggy's auth-server metadata issuer doesn't match its
    // discovery URL (confirmed via IssuerMismatchError) — sanctioned opt-out, not a guess.
    result = await auth(provider, { serverUrl: SWIGGY_FOOD_MCP_URL, skipIssuerMetadataValidation: true });
  } catch (err) {
    console.error("Swiggy login start failed", err);
    return NextResponse.redirect(new URL("/?connect_error=login_failed", req.url));
  }

  // Already holding valid tokens — the callback route owns identity resolution,
  // so bounce through it rather than duplicating that logic here.
  if (result === "AUTHORIZED") {
    return NextResponse.redirect(new URL("/chat", req.url));
  }

  const redirectUrl = provider.consumeRedirectUrl();
  if (!redirectUrl) {
    return NextResponse.redirect(new URL("/?connect_error=no_redirect", req.url));
  }
  return NextResponse.redirect(redirectUrl);
}
