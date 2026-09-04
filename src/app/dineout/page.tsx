import { redirect } from "next/navigation";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { BottomNav } from "@/components/bottom-nav";
import { DineoutView } from "@/components/dineout-view";

export const dynamic = "force-dynamic";

export default async function DineoutPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/");
  const profile = await getProfile(uid);
  if (!profile) redirect("/onboarding");

  return (
    <>
      <main className="app-scroll px-5 md:px-10 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="display text-4xl leading-tight">Eating out</h1>
            <p className="text-ink-muted text-sm mt-1">
              Tables you can book on Swiggy Dineout, with a read on what to order there.
            </p>
          </div>
          <DineoutView addressLabel={profile.defaultAddressLabel} />
        </div>
      </main>
      <BottomNav />
    </>
  );
}
