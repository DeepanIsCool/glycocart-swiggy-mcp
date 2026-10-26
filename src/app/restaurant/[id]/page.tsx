import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { getSwiggyClient, closeClients } from "@/lib/swiggy-mcp-client";
import { RecoverIfExpired } from "@/components/session-recovery";
import { wantsVegOnly } from "@/lib/preferences";
import { buildSwiggyTools } from "@/lib/swiggy-tools";
import { BottomNav } from "@/components/bottom-nav";
import { RestaurantMenu } from "@/components/restaurant-menu";
import { RestaurantHeader } from "@/components/restaurant-card";
import { BackButton } from "./back-button";

export const dynamic = "force-dynamic";

/** What the person can do about a failed load: fix a setting, or retry. */
type LoadError = { message: string; fix: "settings" | "retry" | "reconnect" };

export default async function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await getSessionUid();
  if (!uid) redirect("/");
  const profile = await getProfile(uid);
  if (!profile) redirect("/onboarding");

  let menu: any = null;
  let error: LoadError | null = null;

  if (!profile.defaultAddressId) {
    error = {
      message: "Pick a delivery address in Settings. A menu depends on where it's delivering.",
      fix: "settings"
    };
  } else {
    const client = await getSwiggyClient();
    if (!client) {
      error = { message: "Your Swiggy session has expired.", fix: "reconnect" };
    } else {
      try {
        menu = await buildSwiggyTools(client, profile).get_restaurant_menu.execute(
          { addressId: profile.defaultAddressId, restaurantId: id, page: 1, pageSize: 8 },
          { toolCallId: "page", messages: [] } as any
        );
        if (menu?.success === false) {
          error = { message: menu.error?.message ?? "Swiggy couldn't return this menu.", fix: "retry" };
          menu = null;
        }
      } catch {
        error = { message: "Couldn't load this menu from Swiggy.", fix: "retry" };
      } finally {
        await closeClients(client);
      }
    }
  }

  const r = menu?.restaurant;
  const closed = r?.is_open === false;
  const actionClass =
    "inline-flex items-center justify-center min-h-11 rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

  return (
    <>
      <main className="app-scroll">
        <header className="app-bar">
          <BackButton />
          <span className="flex-1 min-w-0 truncate text-center text-sm font-medium">
            {r?.name ?? "Menu"}
          </span>
          {/* Balances the back button so the title stays centred. */}
          <span className="size-11 shrink-0" aria-hidden />
        </header>

        <div className="px-5 md:px-10 pt-6">
          <div className="max-w-2xl mx-auto">
            {error && (
              <RecoverIfExpired expired={error.fix === "reconnect"}>
              <div className="card-solid p-5" role="alert">
                <p className="font-medium mb-1">This menu didn&apos;t load</p>
                <p className="text-sm text-ink-muted leading-relaxed">{error.message}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {error.fix === "reconnect" ? (
                    <a href="/api/auth/swiggy/login" className={`${actionClass} bg-ink text-cream hover:bg-ink-soft`}>
                      Reconnect Swiggy
                    </a>
                  ) : error.fix === "settings" ? (
                    <Link href="/settings" className={`${actionClass} bg-ink text-cream hover:bg-ink-soft`}>
                      Open Settings
                    </Link>
                  ) : (
                    // A plain anchor, not <Link>: a full request re-runs the
                    // server fetch, where a client navigation to the same URL
                    // may reuse what just failed.
                    <a href={`/restaurant/${encodeURIComponent(id)}`} className={`${actionClass} bg-ink text-cream hover:bg-ink-soft`}>
                      Try again
                    </a>
                  )}
                  <Link
                    href="/chat"
                    className={`${actionClass} border border-ink/10 text-ink-soft hover:text-ink hover:bg-cream-deep/60`}
                  >
                    Back to chat
                  </Link>
                </div>
              </div>
              </RecoverIfExpired>
            )}

            {r && <RestaurantHeader r={r} />}

            {closed && (
              <p className="mt-4 rounded-xl border border-ember/30 bg-cream-warm px-4 py-3 text-sm text-ember-text leading-relaxed">
                Closed on Swiggy right now. The menu and its estimates are here to read, but it
                won&apos;t deliver until it reopens.
              </p>
            )}

            {menu && (
              <p className="text-xs text-ink-muted leading-relaxed mt-4 mb-5">
                Glucose figures are estimates from dish names matched against Indian food
                composition tables. Swiggy publishes no per-dish nutrition, so dishes we can&apos;t
                recognise are marked unscored rather than guessed.
              </p>
            )}

            {menu && (
              <RestaurantMenu
                restaurantId={id}
                initial={menu.categories ?? []}
                hasMore={Boolean(menu.has_more)}
                totalCategories={typeof menu.total_categories === "number" ? menu.total_categories : undefined}
                addressMissing={!profile.defaultAddressId}
                defaultVegOnly={wantsVegOnly(profile.dietary)}
              />
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
