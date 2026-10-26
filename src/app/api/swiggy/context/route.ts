import { NextResponse } from "next/server";
import { getSessionUid } from "@/lib/session";
import { getSwiggyClient, closeClients } from "@/lib/swiggy-mcp-client";
import { callSwiggyRaw, unwrapSwiggy } from "@/lib/swiggy-tools";
import { splitOrderedItems } from "@/lib/orders-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Everything onboarding can learn from the user's Swiggy account, so we don't
 * ask for things Swiggy already knows:
 *   - saved delivery addresses (Swiggy withholds coordinates by design, so the
 *     address line is the location signal available to us)
 *   - dishes they actually order, offered back as suggestions
 *
 * Order history is only ever *suggested* — the user confirms what is a trigger
 * or a safe food. Ordering something is not evidence of how it affects your
 * glucose, and we must not imply otherwise.
 */
export async function GET(req: Request) {
  const uid = await getSessionUid();
  if (!uid) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const client = await getSwiggyClient();
  if (!client) return NextResponse.json({ error: "Swiggy session expired." }, { status: 401 });

  try {
    const addrRes = await callSwiggyRaw(client, "get_addresses", {});
    // A failed lookup used to come back as an empty list with HTTP 200, so
    // Settings said "No saved addresses on your Swiggy account".
    if (addrRes?.success === false) {
      return NextResponse.json(
        { error: addrRes.error?.message ?? "Swiggy didn't return your addresses." },
        { status: 502 }
      );
    }
    const addresses = (unwrapSwiggy(addrRes)?.addresses ?? []).map((a: any) => ({
      id: a.id,
      addressLine: a.addressLine,
      // Users label these freely — one real account has an address categorised
      // "Other" but tagged "Home". Keep both so the list is disambiguable.
      tag: a.addressTag ?? null,
      category: a.addressCategory ?? null
    }));

    let frequentItems: string[] = [];
    let frequentRestaurants: string[] = [];

    // Settings only lists addresses; reading order history there was a second,
    // slower Swiggy call whose result it threw away.
    const addressesOnly = new URL(req.url).searchParams.get("addresses_only") === "1";
    if (!addressesOnly && addresses[0]?.id) {
      try {
        const ordersRes = await callSwiggyRaw(client, "get_food_orders", { addressId: addresses[0].id });
        const orders = unwrapSwiggy(ordersRes)?.orders ?? [];
        frequentItems = rank(orders.flatMap((o: any) => splitOrderedItems(o.orderedItems)));
        frequentRestaurants = rank(orders.map((o: any) => o.restaurantName).filter(Boolean));
      } catch (err) {
        // History is a nice-to-have; onboarding must still work without it.
        console.error("Could not read order history", err);
      }
    }

    return NextResponse.json({ addresses, frequentItems, frequentRestaurants });
  } catch (err) {
    console.error("Swiggy context lookup failed", err);
    return NextResponse.json({ error: "Couldn't reach Swiggy." }, { status: 502 });
  } finally {
    await closeClients(client);
  }
}

function rank(values: string[], limit = 8): string[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const v of values) {
    const key = v.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.n += 1;
    else counts.set(key, { label: v, n: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, limit)
    .map((e) => e.label);
}
