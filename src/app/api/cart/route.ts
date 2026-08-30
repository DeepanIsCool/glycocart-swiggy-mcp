import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { getSwiggyClient } from "@/lib/swiggy-mcp-client";
import { buildCartTools } from "@/lib/cart-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cart operations driven by the UI rather than the agent. Mirrors the same
 * tools the agent gets — notably still no checkout, for the same reason.
 */
async function context() {
  const uid = await getSessionUid();
  if (!uid) return { error: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };
  const profile = await getProfile(uid);
  if (!profile) return { error: NextResponse.json({ error: "Finish onboarding first." }, { status: 403 }) };
  const client = await getSwiggyClient();
  if (!client) return { error: NextResponse.json({ error: "Swiggy session expired." }, { status: 401 }) };
  return { tools: buildCartTools(client, profile), profile };
}

export async function GET() {
  const ctx = await context();
  if (ctx.error) return ctx.error;
  const addressId = ctx.profile!.defaultAddressId;
  if (!addressId) {
    return NextResponse.json({ items: [], needsAddress: true });
  }
  const cart = await ctx.tools!.get_food_cart.execute({ addressId }, { toolCallId: "ui", messages: [] });
  return NextResponse.json(cart);
}

const addSchema = z.object({
  restaurantId: z.string().min(1),
  restaurantName: z.string().min(1),
  // Optional: the saved default is the right answer almost always, and asking
  // every caller to pass it invites one of them to pass the wrong one.
  addressId: z.string().min(1).optional(),
  menuItemId: z.string().min(1),
  quantity: z.coerce.number().min(0).default(1)
});

export async function POST(req: Request) {
  const ctx = await context();
  if (ctx.error) return ctx.error;

  const parsed = addSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid cart request." }, { status: 400 });
  const { restaurantId, restaurantName, menuItemId, quantity } = parsed.data;
  const addressId = parsed.data.addressId ?? ctx.profile!.defaultAddressId;
  if (!addressId) {
    return NextResponse.json({ error: "Pick a delivery address in Settings first." }, { status: 403 });
  }

  const result = await ctx.tools!.update_food_cart.execute(
    {
      restaurantId,
      restaurantName,
      addressId,
      cartItems: [{ menu_item_id: menuItemId, quantity }]
    },
    { toolCallId: "ui", messages: [] }
  );
  return NextResponse.json(result);
}

export async function DELETE() {
  const ctx = await context();
  if (ctx.error) return ctx.error;
  const result = await ctx.tools!.flush_food_cart.execute({}, { toolCallId: "ui", messages: [] });
  return NextResponse.json(result);
}
