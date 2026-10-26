import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { ChatView } from "@/components/chat-view";
import { BottomNav } from "@/components/bottom-nav";

/**
 * The on-screen keyboard used to slide over the composer on Android Chrome,
 * whose default only shrinks the visual viewport, so `100dvh` never changed
 * and the input sat behind the keys. `resizes-content` shrinks the layout
 * viewport instead, and the fixed-height chat column shrinks with it. Next
 * merges this key into the root layout's viewport, so the theme colours and
 * `viewport-fit=cover` there still apply. iOS Safari ignores the key and pans
 * the page to the focused field, which already keeps the composer visible.
 */
export const viewport: Viewport = {
  interactiveWidget: "resizes-content"
};

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
