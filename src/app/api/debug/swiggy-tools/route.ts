import { NextResponse } from "next/server";
import { getSwiggyClient, getInstamartClient, getDineoutClient } from "@/lib/swiggy-mcp-client";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Development-only introspection. Swiggy's published reference lists tool names
 * but not response shapes, and the shapes it does document have been wrong more
 * than once, so the only reliable source is a live call. Returns raw, unshaped
 * payloads.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }

  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const profile = await getProfile(uid);

  const url = new URL(req.url);
  const call = url.searchParams.get("call");
  const server = url.searchParams.get("server") ?? "food";
  const args = JSON.parse(url.searchParams.get("args") ?? "{}");

  const client =
    server === "instamart"
      ? await getInstamartClient()
      : server === "dineout"
        ? await getDineoutClient()
        : await getSwiggyClient();
  if (!client) return NextResponse.json({ error: `${server} client unavailable` }, { status: 502 });

  if (call) {
    const res = await client.callTool({
      name: call,
      arguments: { addressId: profile?.defaultAddressId, ...args }
    });
    const text = (res.content as any[])?.[0]?.text;
    let parsed: any;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = text;
    }
    return NextResponse.json({ isError: res.isError, structured: res.structuredContent, parsed });
  }

  const { tools } = await client.listTools();
  return NextResponse.json({
    server,
    addressId: profile?.defaultAddressId,
    tools: tools.map((t) => ({ name: t.name, description: t.description, input: t.inputSchema }))
  });
}
