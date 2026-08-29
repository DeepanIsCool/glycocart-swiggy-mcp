import { redirect } from "next/navigation";
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
      <main className="app-scroll px-5 md:px-10 py-8">
        <div className="max-w-2xl mx-auto mb-6">
          <p className="mono text-ink-muted text-xs mb-1">settings</p>
          <h1 className="display text-4xl leading-tight">Settings</h1>
        </div>
        <SettingsView
          currentAddressId={profile.defaultAddressId}
          currentAddressLabel={profile.defaultAddressLabel}
        />
      </main>
      <BottomNav />
    </>
  );
}
