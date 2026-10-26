import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export default async function OnboardingPage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/");

  // Returning users edit their existing answers rather than starting blank.
  let existing = null;
  try {
    existing = await getProfile(uid);
  } catch {
    // Surfaced by the wizard's save path if the database is genuinely down.
  }

  return (
    <main className="relative min-h-dvh px-5 md:px-10 py-8">
      {/* The step count lives in the wizard, next to the progress bar. The old
          "step 1 of 2" label here described a flow that no longer exists. */}
      <header className="max-w-2xl mx-auto flex items-center gap-3 mb-8 min-h-11">
        <Image src="/glycocart_logo.png" alt="" width={32} height={32} className="rounded-full" />
        <span className="display text-lg font-medium">GlycoCart</span>
        {existing && (
          <Link href="/profile" className="btn-ghost min-h-11 ml-auto -mr-3">
            Cancel
          </Link>
        )}
      </header>

      <OnboardingWizard initial={existing?.answers} />
    </main>
  );
}
