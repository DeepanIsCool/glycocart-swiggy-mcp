import { redirect } from "next/navigation";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { getSwiggyClient } from "@/lib/swiggy-mcp-client";
import { buildOrderTools } from "@/lib/orders-tools";
import { BottomNav } from "@/components/bottom-nav";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/");
  const profile = await getProfile(uid);
  if (!profile) redirect("/onboarding");

  let orders: any[] = [];
  let error: string | null = null;

  if (!profile.defaultAddressId) {
    error = "Pick a delivery address in Settings to see your orders.";
  } else {
    const client = await getSwiggyClient();
    if (!client) {
      error = "Your Swiggy session expired. Reconnect from Settings.";
    } else {
      try {
        const tools = buildOrderTools(client, profile);
        const res: any = await tools.get_food_orders.execute(
          { addressId: profile.defaultAddressId },
          { toolCallId: "page", messages: [] } as any
        );
        orders = res?.orders ?? [];
        if (res?.success === false) error = "Couldn't load your orders from Swiggy.";
      } catch {
        error = "Couldn't load your orders from Swiggy.";
      }
    }
  }

  return (
    <>
      <main className="app-scroll px-5 md:px-10 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <p className="mono text-ink-muted text-xs mb-1">from your swiggy account</p>
            <h1 className="display text-4xl leading-tight">Orders</h1>
          </div>

          {error && <p className="text-sm text-ember-text mb-4">{error}</p>}

          {!error && orders.length === 0 && (
            <div className="card-solid p-8 text-center">
              <p className="font-medium mb-1">No orders yet</p>
              <p className="text-sm text-ink-muted">Orders you place in Swiggy will show up here.</p>
            </div>
          )}

          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.order_id} className="card-solid p-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="min-w-0">
                    <p className="font-medium text-sm break-words">{o.restaurant ?? "Swiggy order"}</p>
                    {o.area && <p className="text-xs text-ink-muted">{o.area}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    {o.total != null && (
                      <p className="text-sm tabular-nums">
                        {typeof o.total === "number" ? formatINR(o.total) : o.total}
                      </p>
                    )}
                    {o.is_active && (
                      <p className="text-xs text-leaf-text">{o.delivery_status ?? "in progress"}</p>
                    )}
                  </div>
                </div>

                {o.items?.length > 0 && (
                  <p className="text-xs text-ink-muted leading-relaxed mt-1.5">{o.items.join(", ")}</p>
                )}

                {o.glucose && (
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-ink/8 text-xs">
                    <span className="text-ink-soft">
                      ~{o.glucose.estimated_carbs_g}g carbs
                    </span>
                    <span className="text-ink-soft">
                      peak ~{o.glucose.highest_item_peak_mg_dl} mg/dL
                    </span>
                    {o.glucose.items_unscored > 0 && (
                      <span className="text-ink-muted">
                        {o.glucose.items_unscored} not scored
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {orders.length > 0 && (
            <p className="text-xs text-ink-muted leading-relaxed mt-4">
              Glucose figures are retrospective estimates from item names — Swiggy stores no
              nutrition data. Useful for spotting patterns, not for precise numbers.
            </p>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
