import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, Pencil, Info } from "lucide-react";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { BottomNav } from "@/components/bottom-nav";
import { CONDITIONS } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const uid = await getSessionUid();
  if (!uid) redirect("/");

  const profile = await getProfile(uid);
  if (!profile) redirect("/onboarding");

  const m = profile.metabolic;
  const conditionBlurb = CONDITIONS.find((c) => c.id === profile.condition)?.blurb;

  return (
    <>
      <main className="app-scroll px-5 md:px-10 py-8">
        <div className="max-w-2xl mx-auto">
          <header className="flex items-start justify-between gap-4 mb-8">
            <div className="min-w-0">
              <p className="mono text-ink-muted text-xs mb-1">your profile</p>
              <h1 className="display text-4xl leading-tight">{profile.displayName}</h1>
              <p className="text-ink-soft mt-1">{profile.conditionLabel}</p>
              {conditionBlurb && <p className="text-ink-muted text-sm mt-1">{conditionBlurb}</p>}
            </div>
            <Link href="/onboarding" className="btn-ghost shrink-0" aria-label="Edit profile">
              <Pencil size={14} /> edit
            </Link>
          </header>

          {/* Delivery address */}
          <Card title="Delivering to">
            {profile.defaultAddressLabel ? (
              <div className="flex items-start gap-2.5">
                <MapPin size={16} className="text-ink-muted mt-0.5 shrink-0" />
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

          {/* The numbers, and how they were arrived at */}
          <Card title="Your numbers">
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <Stat label="fasting baseline" value={`${m.fastingBaseline}`} unit="mg/dL" />
              <Stat label="carb sensitivity" value={m.insulinSensitivity.toFixed(2)} />
              <Stat label="daily target" value={`${profile.dailyCalTarget}`} unit="kcal" />
            </div>

            <div className="rounded-xl bg-cream p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info size={14} className="text-ink-muted" />
                <span className="mono text-ink-muted text-xs">how we got these</span>
              </div>
              <ul className="space-y-2">
                {m.derivation.map((line, i) => (
                  <li key={i} className="text-sm text-ink-soft leading-relaxed flex gap-2">
                    <span className="text-ink-muted shrink-0">·</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {/* Food preferences — sections hide entirely when empty */}
          {(m.triggers.length > 0 ||
            m.safeFoods.length > 0 ||
            profile.dietary.length > 0 ||
            profile.blocklist.length > 0) && (
            <Card title="Food">
              <div className="space-y-4">
                <ChipRow label="spikes me" items={m.triggers} tone="ember" />
                <ChipRow label="sits well" items={m.safeFoods} tone="leaf" />
                <ChipRow label="dietary" items={profile.dietary} />
                <ChipRow label="avoiding" items={profile.blocklist} />
              </div>
            </Card>
          )}

          <p className="mono text-ink-muted text-xs mt-6">
            updated {new Date(profile.updatedAt).toLocaleDateString("en-IN", {
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-solid p-5 mb-4">
      <h2 className="mono text-ink-muted text-xs mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-cream py-3 px-2 rounded-lg">
      <div className="text-lg font-medium leading-none">
        {value}
        {unit && <span className="text-xs text-ink-muted ml-0.5">{unit}</span>}
      </div>
      <div className="mono text-ink-muted text-xs mt-1.5 leading-tight">{label}</div>
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
      <p className="mono text-ink-muted text-xs mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className={`rounded-full border px-3 py-1 text-sm ${toneClass}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
