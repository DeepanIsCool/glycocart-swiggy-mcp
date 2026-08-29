import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
    fastingBaseline: profile.metabolic.fastingBaseline
  };

  return (
    <>
    <main className="app-main relative flex flex-col overflow-hidden">
      <header className="relative z-10 flex items-center gap-3 px-5 md:px-10 py-3.5 border-b border-ink/10 shrink-0">
        <Image
          src="/glycocart_logo.png"
          alt=""
          width={28}
          height={28}
          className="rounded-full"
        />
        <span className="display text-lg">GlycoCart</span>
        <Link
          href="/profile"
          className="mono text-ink-muted text-xs ml-auto hover:text-ink transition-colors"
        >
          {profile.displayName}
        </Link>
      </header>

      <ChatView profile={view} />
    </main>
    <BottomNav />
    </>
  );
}
