import { NextResponse } from "next/server";
import { getSessionUid } from "@/lib/session";
import { getSwiggyClient } from "@/lib/swiggy-mcp-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Refresh the Swiggy access token where cookies can be written.
 *
 * Server Components can't set cookies, so when Orders or a restaurant page
 * connected with an expired access token, the SDK's refresh threw on saving
 * the new token and the page said "session expired" even though a refresh
 * would have worked. Those pages call this, then re-render.
 */
export async function POST() {
  if (!(await getSessionUid())) return NextResponse.json({ ok: false }, { status: 401 });
  const client = await getSwiggyClient();
  if (!client) return NextResponse.json({ ok: false }, { status: 401 });
  await client.close().catch(() => {});
  return NextResponse.json({ ok: true });
}
