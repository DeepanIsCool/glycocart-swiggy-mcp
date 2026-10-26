import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

/**
 * Deliberately not a SaaS landing page.
 *
 * The previous version had every tell: an ALL-CAPS eyebrow over the headline,
 * one word of it in italic serif, a numbered 01/02/03 explainer, three feature
 * cards under the hero each with an icon in a circle, and a coloured dot
 * reading "live on swiggy mcp". None of that said anything a generated page
 * couldn't. What follows is specific and checkable instead, including the part
 * where the product refuses to do the obvious thing.
 */

/**
 * The OAuth routes send failures back here as `?connect_error=<reason>`.
 * Until this existed the page ignored them, so a failed sign-in looked like
 * the button had done nothing.
 */
const CONNECT_ERRORS: Record<string, string> = {
  no_code:
    "Swiggy didn't send back a sign-in code, which usually means the Swiggy screen was closed before approving. Try again.",
  not_authorized: "Swiggy didn't grant access. Try again and approve the request on Swiggy's screen.",
  login_failed: "Couldn't start sign-in with Swiggy. Try again in a minute.",
  no_redirect: "Couldn't start sign-in with Swiggy. Try again in a minute.",
  oauth_failed: "Swiggy sign-in didn't complete. Try again in a minute.",
  session_unavailable: "Signed in, but GlycoCart couldn't open a session with Swiggy. Try again in a minute."
};

export default async function LandingPage({
  searchParams
}: {
  searchParams: Promise<{ connect_error?: string | string[] }>;
}) {
  const params = await searchParams;
  const reason = Array.isArray(params.connect_error) ? params.connect_error[0] : params.connect_error;
  const connectError = reason
    ? (CONNECT_ERRORS[reason] ?? "Sign-in with Swiggy didn't complete. Try again in a minute.")
    : null;

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <header className="relative z-10 flex items-center justify-between px-5 md:px-10 py-4 md:py-6">
        <div className="flex items-center gap-3">
          <Image src="/glycocart_logo.png" alt="" width={36} height={36} className="rounded-full" />
          <span className="display text-xl font-medium">GlycoCart</span>
        </div>
        <a
          href="https://github.com/DeepanIsCool/glycocart-swiggy-mcp"
          className="btn-ghost min-h-11 -mr-3"
        >
          Source
        </a>
      </header>

      <section className="relative z-10 px-5 md:px-10 pt-6 md:pt-14 pb-16">
        <div className="max-w-5xl mx-auto">
          <h1 className="display text-[2.5rem] sm:text-[4rem] md:text-[5rem] leading-[0.98] tracking-[-0.02em] max-w-3xl">
            Order food that works for your body.
          </h1>

          <div className="mt-7 max-w-xl">
            <p className="text-lg leading-relaxed text-ink-soft">
              For people managing PCOS, prediabetes or type 2 diabetes. Sign in with
              Swiggy and answer seven short screens about your metabolism. Lab values
              are optional. GlycoCart then scores the real dishes near you against your own
              numbers, so the choice that suits you is the one at the top of the list.
            </p>

            {connectError && (
              <p
                role="alert"
                className="mt-6 rounded-xl border border-ember/30 bg-ember-soft/20 px-4 py-3 text-sm text-ink-soft leading-relaxed"
              >
                {connectError}
              </p>
            )}

            <div className="mt-8">
              <a href="/api/auth/swiggy/login" className="btn-swiggy min-h-11 w-full sm:w-auto">
                {connectError ? "Try signing in again" : "Sign in with Swiggy"}
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
              <p className="mt-3 text-sm text-ink-muted leading-relaxed max-w-md">
                You&apos;ll need a Swiggy account. GlycoCart reads your saved addresses
                and recent orders, and builds carts that you check out yourself.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The distinctive claim, given the most space. */}
      <section className="relative z-10 px-5 md:px-10 pb-20">
        <div className="max-w-5xl mx-auto border-t border-ink/10 pt-10">
          <div className="max-w-2xl">
            <h2 className="display text-2xl sm:text-3xl mb-4">It will not place your order.</h2>
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

      <section className="relative z-10 px-5 md:px-10 pb-14">
        <div className="max-w-5xl mx-auto border-t border-ink/10 pt-8">
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
                guessed at. It is a lifestyle tool, not a diagnostic one, and not medical
                advice. Talk to your clinician before changing how you manage your
                condition.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 px-5 md:px-10 pb-12">
        <div className="max-w-5xl mx-auto border-t border-ink/10 pt-6 flex flex-wrap justify-between gap-3 text-sm text-ink-muted">
          <p>Built by Deepan Sadhukhan for Swiggy Builders Club.</p>
          <p>Runs on Swiggy&apos;s production MCP over OAuth 2.1.</p>
        </div>
      </footer>
    </main>
  );
}
