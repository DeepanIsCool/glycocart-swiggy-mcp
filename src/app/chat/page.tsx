import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { PERSONAS, type PersonaId } from "@/lib/personas";
import { ChatView } from "@/components/chat-view";

export default async function ChatPage({
  searchParams
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const sp = await searchParams;
  const id = (sp.p as PersonaId) ?? "pcos";
  if (!PERSONAS[id]) redirect("/");
  const persona = PERSONAS[id];

  return (
    <main className="relative h-screen flex flex-col overflow-hidden">
      <header className="relative z-10 flex items-center justify-between px-5 md:px-10 py-5 border-b border-ink/10">
        <div className="flex items-center gap-3">
          <Link href="/" className="btn-ghost">
            <ArrowLeft size={16} /> back
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
          <p className="mono text-ink-muted text-[0.65rem]">authenticated as</p>
          <p className="display text-base">
            {persona.name} <span className="text-ink-muted text-sm">· {persona.city}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="mono text-ink-muted text-[0.65rem]">condition</p>
          <p className="text-sm font-medium">{persona.condition.split(",")[0]}</p>
        </div>
      </header>

      <ChatView persona={persona} />
    </main>
  );
}
