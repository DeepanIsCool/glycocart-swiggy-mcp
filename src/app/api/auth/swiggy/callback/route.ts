import { NextResponse } from "next/server";
import { auth } from "@modelcontextprotocol/client";
import { CookieOAuthProvider } from "@/lib/swiggy-oauth-provider";
import {
  SWIGGY_FOOD_MCP_URL,
  SWIGGY_REDIRECT_URI,
  getSwiggyClient,
  resolveUid
} from "@/lib/swiggy-mcp-client";
import { setSessionUid, getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const iss = url.searchParams.get("iss") ?? undefined;

  const fail = (reason: string) => NextResponse.redirect(new URL(`/?connect_error=${reason}`, req.url));

  if (!code) return fail("no_code");

  const provider = new CookieOAuthProvider(SWIGGY_REDIRECT_URI);
  try {
    const result = await auth(provider, {
      serverUrl: SWIGGY_FOOD_MCP_URL,
      authorizationCode: code,
      iss,
      // See swiggy-mcp-client.ts for why this is required and safe here.
      skipIssuerMetadataValidation: true
    });
    if (result !== "AUTHORIZED") return fail("not_authorized");
  } catch (err) {
    console.error("Swiggy OAuth callback failed", err);
    return fail("oauth_failed");
  }

  // Establish who this is, so their profile follows the Swiggy account rather
  // than the browser. Done once here, then cached in our own session cookie.
  const client = await getSwiggyClient();
  if (!client) return fail("session_unavailable");

  // Reuse the id already in this browser's session if there is one, so a
  // re-login on the same device keeps the existing profile.
  const uid = await resolveUid(await getSessionUid());
  await setSessionUid(uid);

  let hasProfile = false;
  try {
    hasProfile = !!(await getProfile(uid));
  } catch (err) {
    // A database outage must not strand a signed-in user on a dead end —
    // send them to onboarding, which surfaces the real error if it persists.
    console.error("Profile lookup failed", err);
  }

  return NextResponse.redirect(new URL(hasProfile ? "/chat" : "/onboarding", req.url));
}
