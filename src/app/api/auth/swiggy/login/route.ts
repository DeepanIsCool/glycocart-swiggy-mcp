import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@modelcontextprotocol/client";
import { CookieOAuthProvider } from "@/lib/swiggy-oauth-provider";
import { SWIGGY_FOOD_MCP_URL, SWIGGY_REDIRECT_URI } from "@/lib/swiggy-mcp-client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const persona = url.searchParams.get("p") ?? "pcos";

  const provider = new CookieOAuthProvider(SWIGGY_REDIRECT_URI);

  let result: "AUTHORIZED" | "REDIRECT";
  try {
    // See swiggy-mcp-client.ts: Swiggy's auth-server metadata issuer doesn't match its
    // discovery URL (confirmed via IssuerMismatchError) — sanctioned opt-out, not a guess.
    result = await auth(provider, { serverUrl: SWIGGY_FOOD_MCP_URL, skipIssuerMetadataValidation: true });
  } catch (err) {
    console.error("Swiggy login start failed", err);
    return NextResponse.redirect(new URL(`/chat?p=${persona}&connect_error=1`, req.url));
  }

  if (result === "AUTHORIZED") {
    return NextResponse.redirect(new URL(`/chat?p=${persona}&connected=1`, req.url));
  }

  const redirectUrl = provider.consumeRedirectUrl();
  if (!redirectUrl) {
    return NextResponse.redirect(new URL(`/chat?p=${persona}&connect_error=1`, req.url));
  }

  const jar = await cookies();
  jar.set("swiggy_return_persona", persona, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600
  });

  return NextResponse.redirect(redirectUrl);
}
