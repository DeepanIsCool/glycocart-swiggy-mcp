import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { getSwiggyClient, closeClients } from "@/lib/swiggy-mcp-client";
import { buildCartTools } from "@/lib/cart-tools";
import { callSwiggyRaw } from "@/lib/swiggy-tools";
import type { Client } from "@modelcontextprotocol/client";
import { cartMemory } from "@/lib/cart-memory";
import type { UserProfile } from "@/lib/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { tools: ReturnType<typeof buildCartTools>; profile: UserProfile; client: Client };

/**
 * Cart operations driven by the UI rather than the agent. Mirrors the same
 * tools the agent gets — notably still no checkout, for the same reason.
 * The Swiggy client is opened per request and always closed after.
 */
async function withCart(run: (ctx: Ctx) => Promise<Response>): Promise<Response> {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const profile = await getProfile(uid);
  if (!profile) return NextResponse.json({ error: "Finish onboarding first." }, { status: 403 });
  const client = await getSwiggyClient();
  if (!client) return NextResponse.json({ error: "Swiggy session expired." }, { status: 401 });
  try {
    return await run({ tools: buildCartTools(client, profile, cartMemory(uid)), profile, client });
  } finally {
    await closeClients(client);
  }
}

const opts = { toolCallId: "ui", messages: [] };

export async function GET(req: Request) {
  return withCart(async ({ tools, profile, client }) => {
    const addressId = profile.defaultAddressId;
    if (!addressId) return NextResponse.json({ items: [], needsAddress: true });
    // ?raw=1: the signed-in user's own cart exactly as Swiggy returned it. Its
    // bill schema is undocumented, so this is how to check what it really sends
    // when the Cart tab and the Swiggy app disagree. Read-only, own data only.
    if (new URL(req.url).searchParams.get("raw") === "1") {
      return NextResponse.json({
        addressId,
        raw: await callSwiggyRaw(client, "get_food_cart", { addressId }),
        shaped: await tools.get_food_cart.execute({ addressId }, opts)
      });
    }
    return NextResponse.json(await tools.get_food_cart.execute({ addressId }, opts));
  });
}

// Accept numeric ids too; Swiggy is inconsistent about which it sends.
const id = z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1));

const addSchema = z.object({
  restaurantId: id,
  restaurantName: z.string().min(1),
  // Optional: the saved default is the right answer almost always, and asking
  // every caller to pass it invites one of them to pass the wrong one.
  addressId: z.string().min(1).optional(),
  menuItemId: id,
  quantity: z.coerce.number().int().min(0).max(50).default(1),
  // "add" for Add buttons (one more), "set" for the cart's steppers.
  mode: z.enum(["set", "add"]).default("set")
});

export async function POST(req: Request) {
  // Validate before connecting to Swiggy: a bad request needs no connection.
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid cart request." }, { status: 400 });

  return withCart(async ({ tools, profile }) => {
    const { restaurantId, restaurantName, menuItemId, quantity, mode } = parsed.data;
    const addressId = parsed.data.addressId ?? profile.defaultAddressId;
    if (!addressId) {
      return NextResponse.json({ error: "Pick a delivery address in Settings first." }, { status: 403 });
    }

    const result: any = await tools.update_food_cart.execute(
      {
        restaurantId,
        restaurantName,
        addressId,
        cartItems: [{ menu_item_id: menuItemId, quantity }],
        mode
      },
      opts
    );
    // update_food_cart returns the cart as read back from Swiggy, with its
    // restaurant id attached, or the failure.
    return NextResponse.json(result);
  });
}

export async function DELETE() {
  return withCart(async ({ tools }) => NextResponse.json(await tools.flush_food_cart.execute({}, opts)));
}
