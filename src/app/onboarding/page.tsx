import { redirect } from "next/navigation";
import Image from "next/image";
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
    <main className="relative min-h-dvh px-5 md:px-10 py-10">
      <header className="max-w-2xl mx-auto flex items-center gap-3 mb-10">
        <Image src="/glycocart_logo.png" alt="GlycoCart" width={36} height={36} className="rounded-full" />
        <span className="display text-lg font-medium">GlycoCart</span>
        <span className="mono text-ink-muted text-[0.65rem] ml-auto">
          {existing ? "edit profile" : "step 1 of 2 · your profile"}
        </span>
      </header>

      <OnboardingWizard initial={existing?.answers} />
    </main>
  );
}
