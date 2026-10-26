import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { BottomNav } from "@/components/bottom-nav";
import { SettingsView } from "@/components/settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/");

  const profile = await getProfile(uid);
  if (!profile) redirect("/onboarding");

  return (
    <>
      {/* Settings has no tab of its own; it is pushed from Profile, so it gets
          a back control rather than leaving the tab bar as the only way out. */}
      <header className="app-bar">
        <Link href="/profile" className="app-bar-action" aria-label="Back to Profile">
          <ChevronLeft size={22} aria-hidden />
        </Link>
        <h1 className="text-base font-semibold">Settings</h1>
        <span className="size-11" aria-hidden />
      </header>
      <main className="app-scroll px-4 md:px-10 pt-6">
        <SettingsView
          currentAddressId={profile.defaultAddressId}
          currentAddressLabel={profile.defaultAddressLabel}
        />
      </main>
      <BottomNav />
    </>
  );
}
