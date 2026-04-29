import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Activity, Heart } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
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
        <div className="flex items-center gap-6">
          <a href="https://github.com" className="btn-ghost hidden sm:inline-flex">
            <span className="mono">github</span>
          </a>
          <span className="mono text-ink-muted hidden sm:inline">a swiggy mcp builder</span>
        </div>
      </header>

      {/* Hero — editorial split layout */}
      <section className="relative z-10 px-6 md:px-10 pt-12 md:pt-20 pb-16">
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
              Built on Swiggy's MCP. We read your CGM data or PCOS profile,
              rank every dish on Swiggy by predicted glucose impact, then order it for you.
              No more guessing.
            </p>
            <p className="mono text-ink-muted mt-6 text-xs">
              Demo · 90 seconds · No signup
            </p>
          </div>
        </div>
      </section>

      {/* Persona selector — large, tactile cards */}
      <section className="relative z-10 px-6 md:px-10 pb-20">
        <div className="max-w-7xl mx-auto">
          <p className="mono text-ink-muted mb-6 animate-fade-up" style={{ animationDelay: "0.5s" }}>
            01 · choose a persona
          </p>
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

      {/* Footer note */}
      <section className="relative z-10 px-6 md:px-10 pb-16 max-w-7xl mx-auto">
        <div className="border-t border-ink/10 pt-8 grid md:grid-cols-3 gap-6">
          <Footnote
            num="MCP-native"
            text="Tool schemas mirror swiggy-food, swiggy-instamart, swiggy-dineout. Production-ready swap to live MCP endpoints once approved."
          />
          <Footnote
            num="Personal model"
            text="Glycemic prediction calibrated per user via CGM data + macro vector. Not generic GI tables — your body."
          />
          <Footnote
            num="DPDP-compliant"
            text="Health data encrypted with per-user keys. Explicit consent ledger. Glucose readings never leave the prediction service."
          />
        </div>
      </section>
    </main>
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
