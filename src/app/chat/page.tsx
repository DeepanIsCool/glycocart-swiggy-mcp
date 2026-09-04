import { redirect } from "next/navigation";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { ChatView } from "@/components/chat-view";
import { BottomNav } from "@/components/bottom-nav";

export default async function ChatPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/");

  const profile = await getProfile(uid);
  if (!profile) redirect("/onboarding");

  // Only display-safe fields cross to the browser. The full metabolic profile
  // stays server-side — the client never needs it and never asserts it.
  const view = {
    displayName: profile.displayName,
    conditionLabel: profile.conditionLabel,
    dailyCalTarget: profile.dailyCalTarget,
    blocklist: profile.blocklist,
    fastingBaseline: profile.metabolic.fastingBaseline,
    defaultAddressId: profile.defaultAddressId
  };

  return (
    <>
    {/* ChatView owns the app bar — a page-level header on top of it was two
        headers stacked, which is what made this screen feel like a web page. */}
    <main className="app-main relative flex flex-col overflow-hidden">
      <ChatView profile={view} />
    </main>
    <BottomNav />
    </>
  );
}
