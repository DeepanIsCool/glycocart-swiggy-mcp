import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Activity, Heart, Clock, ShieldCheck, LineChart, type LucideIcon } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6">
        <div className="flex items-center gap-3">
          <Image
            src="/glycocart_logo.png"
            alt="GlycoCart Logo"
            width={40}
            height={40}
            className="rounded-full"
          />
          <span className="display text-xl font-medium">GlycoCart</span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="https://github.com/DeepanIsCool/glycocart-swiggy-mcp"
            className="btn-ghost hidden sm:inline-flex"
          >
            <span className="mono">github</span>
          </a>
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-swiggy/30 bg-swiggy/10 px-3 py-1.5">
            <span className="size-1.5 rounded-full bg-swiggy" />
            <span className="mono text-[0.65rem] text-swiggy">live on swiggy mcp</span>
          </span>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-10 pt-10 md:pt-16 pb-14">
        <div className="max-w-7xl mx-auto grid md:grid-cols-12 gap-10 items-end">
          <div className="md:col-span-8 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <p className="mono text-leaf mb-6">a glucose-aware ordering agent</p>
            <h1 className="display text-[3.2rem] sm:text-[4.5rem] md:text-[6rem] leading-[0.92] tracking-[-0.02em]">
              Order food
              <br />
              that <em className="italic text-leaf font-light">works</em>
              <br />
              for your body.
            </h1>
          </div>
          <div className="md:col-span-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
            <p className="text-lg leading-relaxed text-ink-soft max-w-sm">
              Connect your Swiggy account and GlycoCart estimates the glucose impact of
              real dishes near you — ranked for PCOS, prediabetes and CGM users.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row md:flex-col">
              <a
                href="/api/auth/swiggy/login?p=pcos"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-swiggy px-6 py-3.5 font-medium text-white transition-all hover:brightness-95 active:scale-[0.98]"
              >
                Connect Swiggy &amp; start
                <ArrowUpRight size={16} />
              </a>
              <p className="mono text-ink-muted text-[0.65rem] self-center sm:self-start md:self-center">
                or try the demo below · no signup
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 px-6 md:px-10 pb-16">
        <div className="max-w-7xl mx-auto grid sm:grid-cols-3 gap-5">
          <Step
            n="01"
            Icon={ShieldCheck}
            title="Sign in with Swiggy"
            body="Real OAuth through Swiggy's MCP gateway. We never see your password, and we read only what you approve on Swiggy's consent screen."
          />
          <Step
            n="02"
            Icon={LineChart}
            title="Every dish gets a curve"
            body="We estimate carbs, fibre and glycemic load from Indian food composition tables, then model your 3-hour glucose response."
          />
          <Step
            n="03"
            Icon={Clock}
            title="Decide in seconds"
            body="Dishes are ranked by predicted peak against your profile — so the safe choice is the first one you see, not the one you have to hunt for."
          />
        </div>
      </section>

      {/* Persona selector */}
      <section className="relative z-10 px-6 md:px-10 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-baseline justify-between gap-4 mb-6 flex-wrap">
            <p className="mono text-ink-muted animate-fade-up" style={{ animationDelay: "0.5s" }}>
              or explore the demo · choose a persona
            </p>
            <p className="mono text-ink-muted text-[0.65rem]">no swiggy account needed</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <PersonaCard
              href="/chat?p=pcos"
              tag="pcos · insulin resistance"
              title="Priya, 29"
              subtitle="Bengaluru · Software Engineer"
              body="Diagnosed PCOS 3 years ago. Pays ₹1,800/month to her dietitian for diet plans she struggles to translate to Swiggy. Wants something that just works."
              accent={<Heart size={20} className="text-ember" />}
              delay="0.7s"
            />
            <PersonaCard
              href="/chat?p=cgm"
              tag="cgm · prediabetic"
              title="Arjun, 34"
              subtitle="Mumbai · Product Lead"
              body="Wears Ultrahuman M1. HbA1c 5.9. Already spent ₹50K this year on health. Tired of manually checking every menu against his glucose patterns."
              accent={<Activity size={20} className="text-leaf" />}
              delay="0.85s"
            />
          </div>
        </div>
      </section>

      {/* Footer notes — kept to what is actually true today */}
      <section className="relative z-10 px-6 md:px-10 pb-16 max-w-7xl mx-auto">
        <div className="border-t border-ink/10 pt-8 grid md:grid-cols-3 gap-6">
          <Footnote
            num="Live MCP"
            text="Runs on Swiggy's production Food MCP server over OAuth 2.1 with PKCE. Restaurants, menus and prices come straight from Swiggy."
          />
          <Footnote
            num="Estimated, not measured"
            text="Swiggy publishes no per-dish nutrition, so glucose figures are estimates matched from food composition tables. Dishes we can't estimate are shown unscored, never guessed."
          />
          <Footnote
            num="Not medical advice"
            text="A lifestyle tool, not a diagnostic one. Your Swiggy session is stored encrypted and never leaves the server. Talk to your clinician before changing how you manage your condition."
          />
        </div>
        <p className="mono text-ink-muted text-[0.65rem] mt-8">
          built by deepan sadhukhan · swiggy builders club
        </p>
      </section>
    </main>
  );
}

function Step({
  n,
  Icon,
  title,
  body
}: {
  n: string;
  Icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-6 animate-fade-up">
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-swiggy/12 text-swiggy">
          <Icon size={15} />
        </span>
        <span className="mono text-ink-muted text-[0.65rem]">{n}</span>
      </div>
      <h3 className="display text-xl mb-2">{title}</h3>
      <p className="text-sm text-ink-soft leading-relaxed">{body}</p>
    </div>
  );
}

function PersonaCard({
  href, tag, title, subtitle, body, accent, delay
}: {
  href: string; tag: string; title: string; subtitle: string; body: string;
  accent: React.ReactNode; delay: string;
}) {
  return (
    <Link
      href={href}
      className="card group p-8 md:p-10 hover:bg-cream-warm transition-all hover:-translate-y-0.5 animate-fade-up block"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start justify-between mb-8">
        <span className="mono text-ink-muted">{tag}</span>
        {accent}
      </div>
      <h3 className="display text-3xl md:text-4xl mb-1">{title}</h3>
      <p className="text-ink-muted mb-6">{subtitle}</p>
      <p className="text-ink-soft leading-relaxed mb-8">{body}</p>
      <div className="flex items-center gap-2 text-ink group-hover:gap-3 transition-all">
        <span className="text-sm font-medium">Try the demo as {title.split(",")[0]}</span>
        <ArrowUpRight size={16} className="group-hover:rotate-12 transition-transform" />
      </div>
    </Link>
  );
}

function Footnote({ num, text }: { num: string; text: string }) {
  return (
    <div>
      <p className="mono text-leaf mb-2">{num}</p>
      <p className="text-sm text-ink-soft leading-relaxed">{text}</p>
    </div>
  );
}
