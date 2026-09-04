import { notFound } from "next/navigation";
import { ChatView } from "@/components/chat-view";
import { DishCard } from "@/components/dish-card";
import { RestaurantCard, DineoutCard } from "@/components/restaurant-card";
import { SettingsView } from "@/components/settings-view";
import { BottomNav } from "@/components/bottom-nav";

/**
 * Dev-only screen preview.
 *
 * Every real screen is behind a Swiggy session and a database, so there is no
 * way to look at the chrome — app bar, spacing, dark theme — without a full
 * signed-in environment. This renders the same components against fixed props.
 * It 404s outside development, like /api/debug/swiggy-tools.
 */
export const dynamic = "force-dynamic";

const PROFILE = {
  displayName: "Deepan",
  conditionLabel: "General metabolic health",
  dailyCalTarget: 2600,
  blocklist: ["Refined sugar", "Deep fried"],
  fastingBaseline: 88,
  defaultAddressId: "preview"
};

export default async function PreviewPage({
  searchParams
}: {
  searchParams: Promise<{ screen?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { screen } = await searchParams;

  if (screen === "cards") {
    const curve = Array.from({ length: 19 }, (_, i) => ({
      t: i * 10,
      mgDl: Math.round(88 + 42 * Math.exp(-Math.pow((i * 10 - 45) / 50, 2)))
    }));
    return (
      <>
        <main className="app-scroll px-5 md:px-10 py-8">
          <div className="max-w-2xl mx-auto space-y-3">
            <h1 className="display text-3xl mb-4">Cards</h1>
            <DishCard
              item={{
                id: "1",
                name: "Chicken Pahari Fresh Steam Momo",
                price: 149,
                is_veg: false,
                image_url: null,
                restaurant_id: "785273",
                restaurant_name: "Wow! Momo",
                rating: "4.5",
                in_stock: true,
                is_bestseller: true,
                glycemic: {
                  predicted_peak_mg_dl: 130,
                  match_score: 82,
                  verdict: "good",
                  calories: 350,
                  carbs_g: 40,
                  protein_g: 17,
                  fiber_g: 3,
                  estimate_confidence: "archetype",
                  estimate_basis: "category estimate: steamed dumpling",
                  curve
                }
              }}
              rank={1}
            />
            <DishCard
              item={{ id: "2", name: "Zorbian Flarn Platter", price: 240, is_veg: true, glycemic: null }}
            />
            <RestaurantCard
              r={{
                id: "785273",
                name: "Wow! Momo",
                cuisines: ["Momos", "Chinese"],
                rating: 4.5,
                total_ratings: "3.6K+",
                cost_for_two: "₹300 for two",
                area: "Thakurpukur",
                distance_km: 6.7,
                delivery_time: "40-50 MINS",
                is_open: true
              }}
            />
            <DineoutCard
              r={{
                id: "19964",
                name: "Riyasat e Hind",
                cuisines: ["Mughlai", "North Indian"],
                rating: 4.2,
                rating_count: 1687,
                cost_for_two: "₹1100 for two",
                area: "Ballygunge",
                distance: "6.9 km",
                offers: ["Flat 30% off"],
                highlights: ["Valet parking", "Parking available"],
                brief: {
                  cuisines_used: ["Mughlai", "North Indian"],
                  easier: [
                    { name: "Chicken Tikka", peak_mg_dl: 88, carbs_g: 8 },
                    { name: "Tandoori Chicken", peak_mg_dl: 89, carbs_g: 8 }
                  ],
                  harder: [
                    { name: "Chole Bhature", peak_mg_dl: 131, carbs_g: 92 },
                    { name: "Jeera Rice", peak_mg_dl: 117, carbs_g: 60 }
                  ],
                  note: "Dineout publishes no menu, so these are typical dishes."
                }
              }}
            />
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  if (screen === "settings") {
    return (
      <>
        <main className="app-scroll px-5 md:px-10 py-8">
          <div className="max-w-2xl mx-auto mb-6">
            <h1 className="display text-4xl leading-tight">Settings</h1>
          </div>
          <SettingsView />
        </main>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <main className="app-main relative flex flex-col overflow-hidden">
        <ChatView profile={PROFILE} />
      </main>
      <BottomNav />
    </>
  );
}
