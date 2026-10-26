import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { MapPin, Pencil, Settings as SettingsIcon } from "lucide-react";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { BottomNav } from "@/components/bottom-nav";
import { CONDITIONS, calorieTargetDetail, type CalibrationAnswers, type UserProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

const CRASHES: Record<CalibrationAnswers["crashes"], string> = {
  never: "Rarely",
  sometimes: "Sometimes",
  often: "Often"
};
const ACTIVITY: Record<CalibrationAnswers["activity"], string> = {
  sedentary: "Mostly sitting",
  light: "Light",
  moderate: "Moderate",
  very: "Very active"
};
const GOAL: Record<CalibrationAnswers["goal"], string> = {
  lose: "Lose weight",
  maintain: "Maintain",
  gain: "Gain weight"
};

/**
 * The calorie target has no derivation line in the metabolic profile, so the
 * explanation is rebuilt here from the same rule `deriveCalorieTarget` uses:
 * Mifflin-St Jeor only when age, height and weight are all present, otherwise
 * a fixed default per goal.
 */
function calorieExplanation(p: UserProfile): string {
  const { age, heightCm, weightKg, sex } = p.answers;
  if (age && heightCm && weightKg) {
    const inputs =
      sex === "male" || sex === "female"
        ? "your age, height, weight, sex and activity level"
        : "your age, height, weight and activity level, halfway between the male and female formulas since sex wasn't given";
    const adjust =
      p.goal === "lose" ? ", then 15% lower for weight loss" : p.goal === "gain" ? ", then 10% higher to gain" : "";
    const { limit } = calorieTargetDetail(p.answers);
    const held =
      limit === "floor"
        ? " The formula came out below 1200 kcal, so it is held at 1200, the lowest this app will suggest."
        : limit === "ceiling"
          ? " The formula came out above 4000 kcal, so it is held at 4000."
          : " Rounded to the nearest 50.";
    return `Daily target ${p.dailyCalTarget} kcal from the Mifflin-St Jeor equation, using ${inputs}${adjust}.${held}`;
  }
  return `Daily target ${p.dailyCalTarget} kcal is the default for your goal, because age, height and weight weren't all given. Add them to calculate one for you.`;
}

export default async function ProfilePage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/");

  const profile = await getProfile(uid);
  if (!profile) redirect("/onboarding");

  const m = profile.metabolic;
  const ans = profile.answers;
  const conditionBlurb = CONDITIONS.find((c) => c.id === profile.condition)?.blurb;

  const answered: { label: string; value: string }[] = [
    { label: "Managing", value: profile.conditionLabel },
    { label: "HbA1c", value: typeof ans.hba1c === "number" ? `${ans.hba1c}%` : "Not given" },
    {
      label: "Fasting glucose",
      value: typeof ans.fastingGlucose === "number" ? `${ans.fastingGlucose} mg/dL` : "Not given"
    },
    { label: "Crash after carbs", value: CRASHES[ans.crashes] ?? ans.crashes },
    { label: "Activity", value: ACTIVITY[ans.activity] ?? ans.activity },
    { label: "Goal", value: GOAL[ans.goal] ?? ans.goal },
    {
      label: "Body",
      value:
        [
          ans.age ? `${ans.age} years` : null,
          ans.heightCm ? `${ans.heightCm} cm` : null,
          ans.weightKg ? `${ans.weightKg} kg` : null
        ]
          .filter(Boolean)
          .join(", ") || "Not given"
    }
  ];

  return (
    <>
      <main className="app-scroll px-5 md:px-10 pt-8">
        <div className="max-w-2xl mx-auto">
          <header className="flex items-start justify-between gap-4 mb-8">
            <div className="min-w-0">
              <h1 className="display text-4xl leading-tight break-words">{profile.displayName}</h1>
              <p className="text-ink-soft mt-1">{profile.conditionLabel}</p>
              {conditionBlurb && <p className="text-ink-muted text-sm mt-1">{conditionBlurb}</p>}
            </div>
            {/* Settings gave up its nav tab to Dine out; this is its way in. */}
            <Link href="/settings" className="app-bar-action shrink-0 -mr-2" aria-label="Settings">
              <SettingsIcon size={20} aria-hidden="true" />
            </Link>
          </header>

          <Card title="Delivering to">
            {profile.defaultAddressLabel ? (
              <div className="flex items-start gap-2.5">
                <MapPin size={16} className="text-ink-muted mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-sm text-ink-soft line-clamp-2">{profile.defaultAddressLabel}</p>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                No delivery address chosen yet.{" "}
                <Link href="/settings" className="text-leaf-text underline underline-offset-2">
                  Pick one in Settings
                </Link>
                .
              </p>
            )}
          </Card>

          <Card title="Your estimated numbers">
            <dl className="grid grid-cols-3 gap-2 mb-3 text-center">
              <Stat label="Fasting baseline" value={`${m.fastingBaseline}`} unit="mg/dL" />
              <Stat label="Carb sensitivity" value={m.insulinSensitivity.toFixed(2)} />
              <Stat label="Daily target" value={`${profile.dailyCalTarget}`} unit="kcal" />
            </dl>
            <p className="text-sm text-ink-muted leading-relaxed mb-5">
              GlycoCart uses these to rank dishes for you. They are estimates from
              your answers, not clinical measurements, and not medical advice.
            </p>

            <h3 className="text-sm font-medium text-ink mb-2">How each was worked out</h3>
            <ul className="space-y-2 mb-5">
              {[...m.derivation.slice(0, -1), calorieExplanation(profile), ...m.derivation.slice(-1)].map(
                (line, i) => (
                  <li key={i} className="text-sm text-ink-soft leading-relaxed flex gap-2">
                    <span className="text-ink-muted shrink-0" aria-hidden="true">
                      ·
                    </span>
                    <span>{line}</span>
                  </li>
                )
              )}
            </ul>

            <h3 className="text-sm font-medium text-ink mb-2">From your answers</h3>
            <dl className="divide-y divide-ink/10 border-y border-ink/10">
              {answered.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-sm text-ink-muted shrink-0">{row.label}</dt>
                  <dd className="text-sm text-ink text-right min-w-0">{row.value}</dd>
                </div>
              ))}
            </dl>

            <Link href="/onboarding" className="btn-primary min-h-11 mt-5">
              <Pencil size={15} aria-hidden="true" /> Change answers
            </Link>
          </Card>

          {(m.triggers.length > 0 ||
            m.safeFoods.length > 0 ||
            profile.dietary.length > 0 ||
            profile.blocklist.length > 0) && (
            <Card title="Food">
              <div className="space-y-4">
                <ChipRow label="Spikes me" items={m.triggers} tone="ember" />
                <ChipRow label="Sits well" items={m.safeFoods} tone="leaf" />
                <ChipRow label="Dietary" items={profile.dietary} />
                <ChipRow label="Avoiding" items={profile.blocklist} />
              </div>
            </Card>
          )}

          <p className="text-ink-muted text-sm mt-6">
            Last updated{" "}
            {new Date(profile.updatedAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric"
            })}
          </p>
        </div>
      </main>
      <BottomNav />
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card-solid p-5 mb-4">
      <h2 className="section-label mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-cream py-3 px-2 rounded-lg flex flex-col-reverse">
      <dt className="text-xs text-ink-muted mt-1.5 leading-tight">{label}</dt>
      <dd className="text-lg font-medium leading-none">
        {value}
        {unit && <span className="text-xs text-ink-muted ml-0.5">{unit}</span>}
      </dd>
    </div>
  );
}

function ChipRow({
  label,
  items,
  tone
}: {
  label: string;
  items: string[];
  tone?: "leaf" | "ember";
}) {
  if (items.length === 0) return null;
  const toneClass =
    tone === "leaf"
      ? "bg-leaf-pale/60 border-leaf/20 text-ink"
      : tone === "ember"
        ? "bg-ember-soft/30 border-ember/30 text-ink"
        : "bg-cream border-ink/10 text-ink-soft";
  return (
    <div>
      <h3 className="section-label mb-2">{label}</h3>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item} className={`rounded-full border px-3 py-1 text-sm ${toneClass}`}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
