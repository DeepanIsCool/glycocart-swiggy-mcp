import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

/**
 * Deliberately not a SaaS landing page.
 *
 * The previous version had every tell: an ALL-CAPS eyebrow over the headline,
 * one word of it in italic serif, a numbered 01/02/03 explainer, three feature
 * cards under the hero each with an icon in a circle, and a coloured dot
 * reading "live on swiggy mcp". None of that said anything a generated page
 * couldn't. What follows is specific and checkable instead — including the part
 * where the product refuses to do the obvious thing.
 */
export default function LandingPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6">
        <div className="flex items-center gap-3">
          <Image src="/glycocart_logo.png" alt="" width={36} height={36} className="rounded-full" />
          <span className="display text-xl font-medium">GlycoCart</span>
        </div>
        <a
          href="https://github.com/DeepanIsCool/glycocart-swiggy-mcp"
          className="text-sm text-ink-muted hover:text-ink transition-colors"
        >
          Source
        </a>
      </header>

      <section className="relative z-10 px-6 md:px-10 pt-8 md:pt-14 pb-16">
        <div className="max-w-5xl mx-auto">
          <h1 className="display text-[2.75rem] sm:text-[4rem] md:text-[5rem] leading-[0.95] tracking-[-0.02em] max-w-3xl">
            Order food that works for your body.
          </h1>

          <div className="mt-8 max-w-xl">
            <p className="text-lg leading-relaxed text-ink-soft">
              Sign in with Swiggy and answer a few questions about your metabolism.
              GlycoCart then scores the real dishes near you against your own numbers,
              so the choice that suits you is the one at the top of the list.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <a href="/api/auth/swiggy/login" className="btn-swiggy">
                Sign in with Swiggy
                <ArrowUpRight size={16} />
              </a>
              <p className="text-sm text-ink-muted">You&apos;ll need a Swiggy account.</p>
            </div>
          </div>
        </div>
      </section>

      {/* The distinctive claim, given the most space. */}
      <section className="relative z-10 px-6 md:px-10 pb-20">
        <div className="max-w-5xl mx-auto border-t border-ink/10 pt-10">
          <div className="max-w-2xl">
            <h2 className="display text-2xl sm:text-3xl mb-4">
              It will not place your order.
            </h2>
            <p className="text-ink-soft leading-relaxed mb-4">
              A Swiggy order cannot be cancelled through the API. Once it is placed, the
              only way out is phoning Swiggy on 080-67466729. So GlycoCart builds a real
              cart on your account, prices it, tells you what it will do to your glucose,
              and then stops. You press the last button yourself, in Swiggy.
            </p>
            <p className="text-ink-soft leading-relaxed">
              The agent has no checkout tool at all. Not a rule it has been asked to
              follow, not a confirmation dialog. The tool is simply never given to it, and
              a test in the repository fails if anyone adds one. Table bookings work the
              same way, because Swiggy&apos;s live booking API has no cancel either.
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-6 md:px-10 pb-14">
        <div className="max-w-5xl mx-auto border-t border-ink/10 pt-10">
          <div className="grid md:grid-cols-[16rem_1fr] gap-4 md:gap-10">
            <h2 className="display text-2xl">Where the numbers come from</h2>
            <div className="max-w-2xl">
              <p className="text-ink-soft leading-relaxed mb-4">
                Swiggy publishes no per-dish nutrition, so nothing here is read off a
                label. Carbohydrate, fibre and glycemic load are matched from Indian food
                composition tables, then run through a response model built from your
                questionnaire: your fasting baseline, your carb sensitivity, your calorie
                target.
              </p>
              <p className="text-ink-soft leading-relaxed">
                That makes every figure an estimate, and the app says so every time it
                shows one. A dish it cannot recognise is marked unscored rather than
                guessed at. It is a lifestyle tool, not a diagnostic one; talk to your
                clinician before changing how you manage your condition.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 px-6 md:px-10 pb-12">
        <div className="max-w-5xl mx-auto border-t border-ink/10 pt-6 flex flex-wrap justify-between gap-3 text-sm text-ink-muted">
          <p>Built by Deepan Sadhukhan for Swiggy Builders Club.</p>
          <p>Runs on Swiggy&apos;s production MCP over OAuth 2.1.</p>
        </div>
      </footer>
    </main>
  );
}
