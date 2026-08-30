import { NextResponse } from "next/server";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { getDineoutClient } from "@/lib/swiggy-mcp-client";
import { dineoutSearch } from "@/lib/dineout-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dineout search for the browse page. Read-only by construction: this route
 * can search and enrich, and there is no POST — booking stays in Swiggy.
 */
export async function GET(req: Request) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const profile = await getProfile(uid);
  if (!profile) return NextResponse.json({ error: "Finish onboarding first." }, { status: 403 });

  const client = await getDineoutClient();
  if (!client) {
    return NextResponse.json({ error: "Swiggy Dineout isn't reachable right now." }, { status: 502 });
  }

  const params = new URL(req.url).searchParams;
  const query = (params.get("q") ?? "").trim();
  if (!query) return NextResponse.json({ error: "Search for a cuisine, place or vibe." }, { status: 400 });

  try {
    // Dineout resolves its own coordinates from a saved address id; the food
    // address ids work here too, so the user needs no second setup step.
    const out = await dineoutSearch(
      client,
      profile,
      query,
      { addressId: profile.defaultAddressId },
      { limit: 12, withBriefs: true }
    );
    if ("success" in out) {
      return NextResponse.json(
        { error: out.error?.message ?? "Dineout search failed." },
        { status: 502 }
      );
    }
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: "Dineout search failed. Try again." }, { status: 502 });
  }
}
