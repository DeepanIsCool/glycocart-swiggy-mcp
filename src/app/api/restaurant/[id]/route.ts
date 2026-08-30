import { NextResponse } from "next/server";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { getSwiggyClient } from "@/lib/swiggy-mcp-client";
import { buildSwiggyTools } from "@/lib/swiggy-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Further pages of a restaurant menu — Swiggy caps a call at 8 categories. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const profile = await getProfile(uid);
  if (!profile?.defaultAddressId) {
    return NextResponse.json({ error: "Pick a delivery address in Settings first." }, { status: 403 });
  }
  const client = await getSwiggyClient();
  if (!client) return NextResponse.json({ error: "Swiggy session expired." }, { status: 401 });

  const page = Number(new URL(req.url).searchParams.get("page") ?? 2);
  const menu = await buildSwiggyTools(client, profile).get_restaurant_menu.execute(
    { addressId: profile.defaultAddressId, restaurantId: id, page, pageSize: 8 },
    { toolCallId: "ui", messages: [] } as any
  );
  return NextResponse.json(menu);
}
