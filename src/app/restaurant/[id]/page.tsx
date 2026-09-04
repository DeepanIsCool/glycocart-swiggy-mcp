import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Star, Clock, MapPin } from "lucide-react";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { getSwiggyClient } from "@/lib/swiggy-mcp-client";
import { buildSwiggyTools } from "@/lib/swiggy-tools";
import { BottomNav } from "@/components/bottom-nav";
import { RestaurantMenu } from "@/components/restaurant-menu";

export const dynamic = "force-dynamic";

export default async function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await getSessionUid();
  if (!uid) redirect("/");
  const profile = await getProfile(uid);
  if (!profile) redirect("/onboarding");

  let menu: any = null;
  let error: string | null = null;

  if (!profile.defaultAddressId) {
    error = "Pick a delivery address in Settings. A menu depends on where it's delivering.";
  } else {
    const client = await getSwiggyClient();
    if (!client) {
      error = "Your Swiggy session expired. Reconnect from Settings.";
    } else {
      try {
        menu = await buildSwiggyTools(client, profile).get_restaurant_menu.execute(
          { addressId: profile.defaultAddressId, restaurantId: id, page: 1, pageSize: 8 },
          { toolCallId: "page", messages: [] } as any
        );
        if (menu?.success === false) {
          error = menu.error?.message ?? "Swiggy couldn't return this menu.";
          menu = null;
        }
      } catch {
        error = "Couldn't load this menu from Swiggy.";
      }
    }
  }

  const r = menu?.restaurant;

  return (
    <>
      <main className="app-scroll px-5 md:px-10 py-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/chat" className="btn-ghost -ml-3 mb-4">
            <ArrowLeft size={14} /> back to chat
          </Link>

          {error && <p className="text-sm text-ember-text">{error}</p>}

          {r && (
            <header className="flex items-start gap-4 mb-6">
              {r.image_url && (
                <span className="relative shrink-0 size-20 rounded-2xl overflow-hidden bg-cream-deep">
                  <Image src={r.image_url} alt="" fill sizes="80px" className="object-cover" />
                </span>
              )}
              <div className="min-w-0">
                <h1 className="display text-3xl leading-tight break-words">{r.name}</h1>
                {r.cuisines?.length > 0 && (
                  <p className="text-sm text-ink-muted mt-1">{r.cuisines.join(", ")}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted mt-2">
                  {r.rating && (
                    <span className="inline-flex items-center gap-1">
                      <Star size={11} className="fill-leaf-text text-leaf-text" />
                      <span className="font-medium text-ink-soft">{r.rating}</span>
                      {r.total_ratings && <span>{r.total_ratings}</span>}
                    </span>
                  )}
                  {r.delivery_time && (
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} /> {r.delivery_time}
                    </span>
                  )}
                  {r.cost_for_two && <span>{r.cost_for_two}</span>}
                  {r.area && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} /> {r.area}
                    </span>
                  )}
                </div>
                {r.is_open === false && (
                  <p className="text-xs text-ember-text mt-1.5">Closed right now.</p>
                )}
              </div>
            </header>
          )}

          {menu && (
            <RestaurantMenu
              restaurantId={id}
              initial={menu.categories ?? []}
              hasMore={Boolean(menu.has_more)}
              addressMissing={!profile.defaultAddressId}
            />
          )}

          {menu && (
            <p className="text-xs text-ink-muted leading-relaxed mt-6">
              Glucose figures are estimates from dish names matched against Indian food composition
              tables. Swiggy publishes no per-dish nutrition, so items we can&apos;t recognise are
              marked unscored rather than guessed.
            </p>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
