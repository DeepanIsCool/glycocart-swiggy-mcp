"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, X } from "lucide-react";
import { CONDITIONS, type CalibrationAnswers } from "@/lib/profile";
import { cn } from "@/lib/utils";

const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Eggetarian", "Jain", "No beef", "No pork", "High protein", "Low carb"];
const COMMON_AVOIDS = ["Refined sugar", "White rice", "Maida", "Deep fried", "Sugary drinks", "Excess dairy"];

const STEP_COUNT = 5;

export function OnboardingWizard({ initial }: { initial?: Partial<CalibrationAnswers> }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [a, setA] = useState<CalibrationAnswers>({
    displayName: initial?.displayName ?? "",
    condition: initial?.condition ?? "general",
    hba1c: initial?.hba1c,
    fastingGlucose: initial?.fastingGlucose,
    crashes: initial?.crashes ?? "sometimes",
    activity: initial?.activity ?? "light",
    goal: initial?.goal ?? "maintain",
    age: initial?.age,
    sex: initial?.sex ?? "unspecified",
    heightCm: initial?.heightCm,
    weightKg: initial?.weightKg,
    dietary: initial?.dietary ?? [],
    blocklist: initial?.blocklist ?? [],
    triggers: initial?.triggers ?? [],
    safeFoods: initial?.safeFoods ?? []
  });

  const set = <K extends keyof CalibrationAnswers>(k: K, v: CalibrationAnswers[K]) =>
    setA((prev) => ({ ...prev, [k]: v }));

  const toggle = (k: "dietary" | "blocklist", value: string) =>
    setA((prev) => ({
      ...prev,
      [k]: prev[k].includes(value) ? prev[k].filter((x) => x !== value) : [...prev[k], value]
    }));

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(a)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Couldn't save your profile.");
      }
      router.push("/chat");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  const canAdvance = step === 0 ? a.displayName.trim().length > 0 : true;

  return (
    <div className="max-w-2xl mx-auto w-full">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= step ? "bg-swiggy" : "bg-ink/10"
            )}
          />
        ))}
      </div>

      {step === 0 && (
        <Section
          title="First — what should we call you?"
          sub="This is only used to greet you. Nothing here is shared with Swiggy."
        >
          <input
            autoFocus
            value={a.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            placeholder="Your first name"
            className="w-full bg-cream-warm border border-ink/10 rounded-xl px-4 py-3 text-base outline-none focus:border-leaf"
          />

          <p className="mono text-ink-muted text-[0.7rem] mt-8 mb-3">what are you managing?</p>
          <div className="grid gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => set("condition", c.id)}
                className={cn(
                  "text-left rounded-xl border px-4 py-3 transition-colors",
                  a.condition === c.id
                    ? "border-leaf bg-leaf-pale/40"
                    : "border-ink/10 bg-cream-warm hover:bg-cream-deep"
                )}
              >
                <span className="block font-medium text-sm">{c.label}</span>
                <span className="block text-ink-muted text-xs mt-0.5">{c.blurb}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {step === 1 && (
        <Section
          title="Do you know any recent numbers?"
          sub="Optional — but they replace our estimates with your actual values. Skip if you don't have them to hand."
        >
          <NumberField
            label="HbA1c (%)"
            hint="From a blood test in the last few months"
            value={a.hba1c}
            onChange={(v) => set("hba1c", v)}
            step="0.1"
            placeholder="e.g. 5.8"
          />
          <NumberField
            label="Fasting glucose (mg/dL)"
            hint="Morning reading, before eating"
            value={a.fastingGlucose}
            onChange={(v) => set("fastingGlucose", v)}
            placeholder="e.g. 95"
          />
          <p className="text-xs text-ink-muted leading-relaxed mt-4">
            If you give an HbA1c we convert it using the standard ADA average-glucose
            formula. Without either number we start from a typical value for your
            condition — an estimate, not a measurement.
          </p>
        </Section>
      )}

      {step === 2 && (
        <Section
          title="How does your body usually behave?"
          sub="This shapes how sharply we expect carbs to hit you."
        >
          <Choice
            label="After a carb-heavy meal, do you crash?"
            value={a.crashes}
            onChange={(v) => set("crashes", v)}
            options={[
              { value: "never", label: "Rarely" },
              { value: "sometimes", label: "Sometimes" },
              { value: "often", label: "Often" }
            ]}
          />
          <Choice
            label="Activity level"
            value={a.activity}
            onChange={(v) => set("activity", v)}
            options={[
              { value: "sedentary", label: "Sedentary" },
              { value: "light", label: "Light" },
              { value: "moderate", label: "Moderate" },
              { value: "very", label: "Very active" }
            ]}
          />
          <Choice
            label="Your goal"
            value={a.goal}
            onChange={(v) => set("goal", v)}
            options={[
              { value: "lose", label: "Lose weight" },
              { value: "maintain", label: "Maintain" },
              { value: "gain", label: "Gain" }
            ]}
          />
        </Section>
      )}

      {step === 3 && (
        <Section
          title="A few body basics"
          sub="Only used to set a daily calorie target. Skip and we'll use a sensible default you can edit."
        >
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Age" value={a.age} onChange={(v) => set("age", v)} placeholder="29" />
            <NumberField label="Weight (kg)" value={a.weightKg} onChange={(v) => set("weightKg", v)} placeholder="62" />
            <NumberField label="Height (cm)" value={a.heightCm} onChange={(v) => set("heightCm", v)} placeholder="165" />
            <div>
              <label className="mono text-ink-muted text-[0.65rem] block mb-1.5">sex</label>
              <select
                value={a.sex}
                onChange={(e) => set("sex", e.target.value as CalibrationAnswers["sex"])}
                className="w-full bg-cream-warm border border-ink/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-leaf"
              >
                <option value="unspecified">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-ink-muted mt-3">
            Used with the Mifflin-St Jeor equation — the standard way to estimate daily energy needs.
          </p>
        </Section>
      )}

      {step === 4 && (
        <Section
          title="Food preferences"
          sub="What you eat, what you avoid, and anything you already know spikes you."
        >
          <ChipGroup
            label="dietary preferences"
            options={DIETARY_OPTIONS}
            selected={a.dietary}
            onToggle={(v) => toggle("dietary", v)}
          />
          <ChipGroup
            label="foods to avoid"
            options={COMMON_AVOIDS}
            selected={a.blocklist}
            onToggle={(v) => toggle("blocklist", v)}
          />
          <FreeList
            label="foods you know spike you"
            hint="e.g. white rice, chole bhature"
            values={a.triggers}
            onChange={(v) => set("triggers", v)}
          />
          <FreeList
            label="foods that always sit well"
            hint="e.g. dal, ragi roti"
            values={a.safeFoods}
            onChange={(v) => set("safeFoods", v)}
          />
        </Section>
      )}

      {error && <p className="text-sm text-ember mt-6">{error}</p>}

      <div className="flex items-center justify-between mt-10">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="btn-ghost disabled:opacity-0"
        >
          <ArrowLeft size={16} /> back
        </button>

        {step < STEP_COUNT - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance}
            className="inline-flex items-center gap-2 rounded-full bg-swiggy px-6 py-3 font-medium text-white transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-40"
          >
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-swiggy px-6 py-3 font-medium text-white transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? "Saving…" : "Build my profile"}
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="animate-fade-up">
      <h2 className="display text-3xl mb-2">{title}</h2>
      <p className="text-ink-muted text-sm mb-7 leading-relaxed">{sub}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function NumberField({
  label, hint, value, onChange, placeholder, step
}: {
  label: string;
  hint?: string;
  value?: number;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div>
      <label className="mono text-ink-muted text-[0.65rem] block mb-1.5">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="w-full bg-cream-warm border border-ink/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-leaf"
      />
      {hint && <p className="text-[0.7rem] text-ink-muted mt-1">{hint}</p>}
    </div>
  );
}

function Choice<T extends string>({
  label, value, onChange, options
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div>
      <label className="mono text-ink-muted text-[0.65rem] block mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              value === o.value
                ? "border-leaf bg-leaf-pale/50 text-ink"
                : "border-ink/10 bg-cream-warm hover:bg-cream-deep text-ink-soft"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipGroup({
  label, options, selected, onToggle
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <label className="mono text-ink-muted text-[0.65rem] block mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
              selected.includes(o)
                ? "border-leaf bg-leaf-pale/50"
                : "border-ink/10 bg-cream-warm hover:bg-cream-deep text-ink-soft"
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function FreeList({
  label, hint, values, onChange
}: {
  label: string;
  hint: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return setDraft("");
    onChange([...values, v]);
    setDraft("");
  };

  return (
    <div>
      <label className="mono text-ink-muted text-[0.65rem] block mb-2">{label}</label>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={hint}
          className="flex-1 bg-cream-warm border border-ink/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-leaf"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-xl border border-ink/10 bg-cream-warm px-3 hover:bg-cream-deep transition-colors"
          aria-label={`Add to ${label}`}
        >
          <Plus size={16} />
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1.5 rounded-full bg-leaf-pale/50 border border-leaf/20 px-3 py-1 text-sm"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
                className="text-ink-muted hover:text-ink"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
