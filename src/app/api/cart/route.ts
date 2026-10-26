import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { getSwiggyClient } from "@/lib/swiggy-mcp-client";
import { buildCartTools } from "@/lib/cart-tools";
import { secureCookie } from "@/lib/crypto";

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

const opts = { toolCallId: "ui", messages: [] };

/**
 * Swiggy's cart names its restaurant but carries no restaurant id, and
 * update_food_cart needs one, so the quantity steppers had nothing to send and
 * never rendered. Remember the id from the last successful add, and attach it
 * when the cart read names the same restaurant.
 */
const CART_RESTAURANT = "gc_cart_restaurant";

async function rememberRestaurant(id: string, name: string) {
  (await cookies()).set(CART_RESTAURANT, JSON.stringify({ id, name }), {
    httpOnly: true,
    secure: secureCookie,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

async function withRestaurantId(cart: any) {
  if (!cart || cart.success === false || !cart.restaurant?.name || cart.restaurant.id) return cart;
  try {
    const saved = JSON.parse((await cookies()).get(CART_RESTAURANT)?.value ?? "null");
    if (
      typeof saved?.id === "string" &&
      typeof saved?.name === "string" &&
      saved.name.trim().toLowerCase() === String(cart.restaurant.name).trim().toLowerCase()
    ) {
      return { ...cart, restaurant: { ...cart.restaurant, id: saved.id } };
    }
  } catch {
    /* unreadable cookie: steppers stay hidden, nothing else breaks */
  }
  return cart;
}

export async function GET() {
  const ctx = await context();
  if (ctx.error) return ctx.error;
  const addressId = ctx.profile!.defaultAddressId;
  if (!addressId) {
    return NextResponse.json({ items: [], needsAddress: true });
  }
  const cart = await ctx.tools!.get_food_cart.execute({ addressId }, opts);
  return NextResponse.json(await withRestaurantId(cart));
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
  const ctx = await context();
  if (ctx.error) return ctx.error;

  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid cart request." }, { status: 400 });
  const { restaurantId, restaurantName, menuItemId, quantity, mode } = parsed.data;
  const addressId = parsed.data.addressId ?? ctx.profile!.defaultAddressId;
  if (!addressId) {
    return NextResponse.json({ error: "Pick a delivery address in Settings first." }, { status: 403 });
  }

  const result: any = await ctx.tools!.update_food_cart.execute(
    {
      restaurantId,
      restaurantName,
      addressId,
      cartItems: [{ menu_item_id: menuItemId, quantity }],
      mode
    },
    opts
  );
  if (result?.success === false) return NextResponse.json(result);

  await rememberRestaurant(restaurantId, restaurantName);
  // update_food_cart answers with a status message, not the cart, so the UI
  // replaced the cart with an empty one after every stepper tap. Read it back.
  const cart = await ctx.tools!.get_food_cart.execute({ addressId }, opts);
  return NextResponse.json(await withRestaurantId(cart));
}

export async function DELETE() {
  const ctx = await context();
  if (ctx.error) return ctx.error;
  const result = await ctx.tools!.flush_food_cart.execute({}, opts);
  return NextResponse.json(result);
}
