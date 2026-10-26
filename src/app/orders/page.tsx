import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { getSwiggyClient } from "@/lib/swiggy-mcp-client";
import { RecoverIfExpired } from "@/components/session-recovery";
import { buildOrderTools } from "@/lib/orders-tools";
import { BottomNav } from "@/components/bottom-nav";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

type LoadError = { message: string; action: "address" | "reconnect" | "retry" };

/**
 * Swiggy's `orderedTime` may be an epoch value or a date string. Show it only
 * when it parses, rather than a garbled date. Formatted in IST because every
 * Swiggy order is in India and this renders on a server whose clock is UTC.
 */
function formatOrderedAt(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  let d: Date;
  if (typeof raw === "number" || (typeof raw === "string" && /^\d+$/.test(raw))) {
    const n = Number(raw);
    d = new Date(n < 1e12 ? n * 1000 : n);
  } else if (typeof raw === "string") {
    d = new Date(raw);
    // A string with no zone parses in the server's zone (UTC on Vercel), which
    // put every order 5h30m late. Swiggy's times are Indian: read it as IST.
    if (!Number.isNaN(d.getTime()) && !/(z|gmt|utc|[+-]\d{2}:?\d{2})\s*$/i.test(raw.trim())) {
      d = new Date(d.getTime() - d.getTimezoneOffset() * 60_000 - 330 * 60_000);
    }
  } else {
    return null;
  }
  if (Number.isNaN(d.getTime())) return typeof raw === "string" ? raw : null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata"
  }).format(d);
}

export default async function OrdersPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/");
  const profile = await getProfile(uid);
  if (!profile) redirect("/onboarding");

  let orders: any[] = [];
  let error: LoadError | null = null;

  if (!profile.defaultAddressId) {
    error = { message: "Pick a delivery address to see your Swiggy orders.", action: "address" };
  } else {
    const client = await getSwiggyClient();
    if (!client) {
      error = { message: "Your Swiggy session has expired.", action: "reconnect" };
    } else {
      try {
        const tools = buildOrderTools(client, profile);
        const res: any = await tools.get_food_orders.execute(
          { addressId: profile.defaultAddressId },
          { toolCallId: "page", messages: [] } as any
        );
        orders = res?.orders ?? [];
        if (res?.success === false) {
          // A saved address deleted in the Swiggy app fails every retry; the
          // fix is picking another one.
          error = res?.recovery
            ? { message: "Your saved delivery address is no longer on your Swiggy account.", action: "address" }
            : { message: "Swiggy didn't return your orders.", action: "retry" };
        }
      } catch {
        error = { message: "Swiggy didn't return your orders.", action: "retry" };
      }
    }
  }

  return (
    <>
      <main className="app-scroll px-5 md:px-10 pt-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="display text-4xl leading-tight">Orders</h1>
            <p className="text-ink-muted text-sm mt-1">
              Orders you placed in Swiggy, each with an estimate of its glucose impact.
            </p>
          </div>

          {error && (
            // An expired access token can't be refreshed while rendering here;
            // try once through a route handler before asking to reconnect.
            <RecoverIfExpired expired={error.action === "reconnect"}>
            <div className="card-solid p-5 mb-4" role="alert">
              <p className="font-medium mb-1">Orders didn&apos;t load</p>
              <p className="text-sm text-ink-soft leading-relaxed">{error.message}</p>
              <div className="mt-4">
                {error.action === "address" && (
                  <Link href="/settings" className="btn-primary text-sm min-h-11">
                    Pick an address in Settings
                  </Link>
                )}
                {error.action === "reconnect" && (
                  <a href="/api/auth/swiggy/login" className="btn-primary text-sm min-h-11">
                    Reconnect Swiggy
                  </a>
                )}
                {/* A full navigation to this page re-runs the server fetch. */}
                {error.action === "retry" && (
                  <a href="/orders" className="btn-primary text-sm min-h-11">
                    Try again
                  </a>
                )}
              </div>
            </div>
            </RecoverIfExpired>
          )}

          {!error && orders.length === 0 && (
            <div className="card-solid p-6">
              <p className="font-medium mb-1">No orders yet</p>
              <p className="text-sm text-ink-muted leading-relaxed">
                Orders you place in the Swiggy app for this delivery address show up here.
              </p>
              <Link href="/chat" className="btn-primary text-sm min-h-11 mt-4">
                Find something to eat
              </Link>
            </div>
          )}

          {orders.length > 0 && (
            <>
              <p className="text-xs text-ink-muted leading-relaxed mb-3">
                Glucose figures are retrospective estimates from item names. Swiggy stores no
                nutrition data, so use them to spot patterns, not as precise numbers.
              </p>

              <ul className="space-y-3">
                {orders.map((o, idx) => {
                  const when = formatOrderedAt(o.ordered_at);
                  const status: string | null = o.is_active
                    ? (o.delivery_status ?? "In progress")
                    : (o.status ?? null);
                  const items: string[] = Array.isArray(o.items) ? o.items : [];
                  const meta = [when, o.area].filter(Boolean).join(", ");
                  return (
                    <li key={o.order_id ?? idx} className="card-solid p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm break-words">
                            {o.restaurant ?? "Swiggy order"}
                          </p>
                          {meta && <p className="text-xs text-ink-muted mt-0.5">{meta}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          {o.total != null && (
                            <p className="text-sm tabular-nums">
                              {typeof o.total === "number" ? formatINR(o.total) : o.total}
                            </p>
                          )}
                          {status && (
                            <p
                              className={
                                o.is_active ? "text-xs font-medium text-leaf-text" : "text-xs text-ink-muted"
                              }
                            >
                              {status}
                            </p>
                          )}
                        </div>
                      </div>

                      {items.length > 0 && (
                        <p className="text-sm text-ink-soft leading-relaxed mt-2">{items.join(", ")}</p>
                      )}

                      <div className="mt-3 pt-3 border-t border-ink/10 text-xs">
                        {o.glucose ? (
                          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-ink-soft">
                            <div>
                              <dt className="sr-only">Estimated carbohydrate</dt>
                              <dd className="tabular-nums">Est. {o.glucose.estimated_carbs_g}g carbs</dd>
                            </div>
                            <div>
                              <dt className="sr-only">Estimated highest single-dish peak</dt>
                              <dd className="tabular-nums">
                                Est. peak {o.glucose.highest_item_peak_mg_dl} mg/dL
                              </dd>
                            </div>
                            {o.glucose.items_unscored > 0 && (
                              <div className="text-ink-muted">
                                <dt className="sr-only">Coverage</dt>
                                <dd>
                                  {o.glucose.items_scored} of {items.length} items estimated
                                </dd>
                              </div>
                            )}
                          </dl>
                        ) : (
                          <p className="text-ink-muted">
                            Not estimated. None of these items matched our food tables.
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
