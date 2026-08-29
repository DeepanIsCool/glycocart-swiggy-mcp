import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { ChatView } from "@/components/chat-view";

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
    <main className="relative h-dvh flex flex-col overflow-hidden">
      <header className="relative z-10 flex items-center justify-between px-5 md:px-10 py-5 border-b border-ink/10">
        <div className="flex items-center gap-3">
          <Link href="/" className="btn-ghost">
            <ArrowLeft size={16} /> home
          </Link>
          <Image
            src="/glycocart_logo.png"
            alt="GlycoCart"
            width={32}
            height={32}
            className="rounded-full hidden sm:block"
          />
        </div>
        <div className="text-center">
          <p className="mono text-ink-muted text-[0.65rem]">signed in as</p>
          <p className="display text-base">{profile.displayName}</p>
        </div>
        <div className="text-right">
          <p className="mono text-ink-muted text-[0.65rem]">condition</p>
          <Link href="/onboarding" className="text-sm font-medium hover:text-leaf transition-colors">
            {profile.conditionLabel}
          </Link>
        </div>
      </header>

      <ChatView profile={view} />
    </main>
  );
}
