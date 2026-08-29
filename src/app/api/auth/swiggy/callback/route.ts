import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@modelcontextprotocol/client";
import { CookieOAuthProvider } from "@/lib/swiggy-oauth-provider";
import { SWIGGY_FOOD_MCP_URL, SWIGGY_REDIRECT_URI } from "@/lib/swiggy-mcp-client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const iss = url.searchParams.get("iss") ?? undefined;

  const jar = await cookies();
  const persona = jar.get("swiggy_return_persona")?.value ?? "pcos";
  jar.delete("swiggy_return_persona");

  if (!code) {
    return NextResponse.redirect(new URL(`/chat?p=${persona}&connect_error=1`, req.url));
  }

  const provider = new CookieOAuthProvider(SWIGGY_REDIRECT_URI);
  try {
    const result = await auth(provider, {
      serverUrl: SWIGGY_FOOD_MCP_URL,
      authorizationCode: code,
      iss,
      // See swiggy-mcp-client.ts for why this is required and safe here.
      skipIssuerMetadataValidation: true
    });
    const status = result === "AUTHORIZED" ? "1" : "0";
    return NextResponse.redirect(new URL(`/chat?p=${persona}&connected=${status}`, req.url));
  } catch (err) {
    console.error("Swiggy OAuth callback failed", err);
    return NextResponse.redirect(new URL(`/chat?p=${persona}&connect_error=1`, req.url));
  }
}
