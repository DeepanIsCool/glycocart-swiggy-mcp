"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, Plus, RefreshCw, X } from "lucide-react";
import { CONDITIONS, type CalibrationAnswers } from "@/lib/profile";
import { cn } from "@/lib/utils";

const DIETARY_OPTIONS = ["Vegetarian", "Vegan", "Eggetarian", "Jain", "No beef", "No pork", "High protein", "Low carb"];
const COMMON_AVOIDS = ["Refined sugar", "White rice", "Maida", "Deep fried", "Sugary drinks", "Excess dairy"];

/**
 * One question per step where the question stands alone. The three
 * "how does your body behave" choices stay together because each is a single
 * tap with a default already selected, and splitting them would triple the
 * taps for no gain.
 */
const STEPS = ["name", "condition", "address", "labs", "behaviour", "basics", "food"] as const;
type StepId = (typeof STEPS)[number];
const STEP_COUNT = STEPS.length;
const stepIndex = (id: StepId) => STEPS.indexOf(id);

type NumKey = "hba1c" | "fastingGlucose" | "age" | "heightCm" | "weightKg";
type ListKey = "triggers" | "safeFoods";
type FieldKey = keyof CalibrationAnswers;
type Errors = Partial<Record<FieldKey, string>>;

/** Which step owns each field, so a save error can send the user back to it. */
const FIELD_STEP: Record<FieldKey, StepId> = {
  displayName: "name",
  condition: "condition",
  defaultAddressId: "address",
  defaultAddressLabel: "address",
  hba1c: "labs",
  fastingGlucose: "labs",
  crashes: "behaviour",
  activity: "behaviour",
  goal: "behaviour",
  age: "basics",
  sex: "basics",
  heightCm: "basics",
  weightKg: "basics",
  dietary: "food",
  blocklist: "food",
  triggers: "food",
  safeFoods: "food"
};

const NUM_KEYS: NumKey[] = ["hba1c", "fastingGlucose", "age", "heightCm", "weightKg"];

/** Field ids, so validation can move focus to the first field that failed. */
const fieldId = (k: FieldKey) => `ob-${k}`;

/**
 * Number fields are validated against the same ranges the /api/profile schema
 * enforces, so the server should never be the first to say no. The messages
 * name the likely mistake (a unit mix-up) rather than just the range.
 */
function validateNumber(key: NumKey, raw: string): string | null {
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return "Enter digits only, for example 5.8.";
  const n = Number(s);

  switch (key) {
    case "hba1c":
      if (n > 20 && n <= 150) return "That looks like mmol/mol. Enter the percentage from your report instead, for example 5.8.";
      if (n < 3 || n > 20) return "HbA1c is a percentage between 3 and 20. Leave it blank if you're not sure.";
      return null;
    case "fastingGlucose":
      if (n >= 2 && n < 40) return "That looks like mmol/L. GlycoCart uses mg/dL: multiply by 18, so 5.5 mmol/L is 99 mg/dL.";
      if (n < 40 || n > 400) return "Enter a value between 40 and 400 mg/dL, or leave it blank.";
      return null;
    case "age":
      if (!Number.isInteger(n)) return "Enter your age in whole years.";
      if (n < 12 || n > 100) return "Enter an age between 12 and 100.";
      return null;
    case "heightCm":
      if (n >= 1 && n < 3) return "That looks like metres. Enter centimetres, for example 165.";
      if (n >= 3 && n < 9) return "That looks like feet. Enter centimetres: 5 ft 5 in is 165 cm.";
      if (n < 100 || n > 230) return "Enter a height between 100 and 230 cm.";
      return null;
    default:
      // weightKg
      if (n < 25 || n > 300) return "Enter a weight between 25 and 300 kg.";
      return null;
  }
}

function toNumber(raw: string): number | undefined {
  const s = raw.trim().replace(",", ".");
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

interface SwiggyContext {
  addresses: { id: string; addressLine: string; tag: string | null; category: string | null }[];
  frequentItems: string[];
  frequentRestaurants: string[];
}

/**
 * Answers survive a reload, a failed save and a re-sign-in in the same tab.
 * sessionStorage, not localStorage: health answers should not outlive the tab
 * on a shared phone. Only written once something differs from the starting
 * answers, cleared as soon as the profile saves, and ignored after 30 minutes
 * so an abandoned edit doesn't reappear the next time Profile is edited.
 */
const DRAFT_KEY = "glycocart:onboarding-draft:v1";
const DRAFT_TTL_MS = 30 * 60 * 1000;
const EMPTY_PENDING: Record<ListKey, string> = { triggers: "", safeFoods: "" };
interface Draft {
  a: CalibrationAnswers;
  nums: Record<NumKey, string>;
  pending: Record<ListKey, string>;
  step: number;
  savedAt: number;
}

function answersFrom(initial?: Partial<CalibrationAnswers>): CalibrationAnswers {
  return {
    displayName: initial?.displayName ?? "",
    defaultAddressId: initial?.defaultAddressId,
    defaultAddressLabel: initial?.defaultAddressLabel,
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
  };
}

function numsFrom(initial?: Partial<CalibrationAnswers>): Record<NumKey, string> {
  const out = {} as Record<NumKey, string>;
  for (const k of NUM_KEYS) {
    const v = initial?.[k];
    out[k] = typeof v === "number" ? String(v) : "";
  }
  return out;
}

export function OnboardingWizard({ initial }: { initial?: Partial<CalibrationAnswers> }) {
  const router = useRouter();
  const isEditing = Boolean(initial);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ message: string; detail?: string; signIn?: boolean } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [ctx, setCtx] = useState<SwiggyContext | null>(null);
  const [ctxState, setCtxState] = useState<"loading" | "ready" | "failed">("loading");
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstStepRender = useRef(true);

  const [a, setA] = useState<CalibrationAnswers>(() => answersFrom(initial));

  // Number fields hold the raw text, so "5." or "5,8" mid-typing is never
  // rewritten under the cursor, and a bad value is shown back rather than lost.
  const [nums, setNums] = useState<Record<NumKey, string>>(() => numsFrom(initial));

  // Text typed into "add a food" but not yet added. Held here, not in the
  // field, so it survives Back and is included on save instead of dropped.
  const [pending, setPending] = useState<Record<ListKey, string>>(EMPTY_PENDING);

  const set = <K extends keyof CalibrationAnswers>(k: K, v: CalibrationAnswers[K]) => {
    setA((prev) => ({ ...prev, [k]: v }));
    clearError(k);
  };

  const clearError = (k: FieldKey) =>
    setErrors((prev) => {
      if (!(k in prev)) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });

  // Restore an unsaved draft from this tab, once, after hydration.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Draft>;
        const fresh = typeof d.savedAt === "number" && Date.now() - d.savedAt < DRAFT_TTL_MS;
        if (fresh && d.a && typeof d.a === "object") {
          const draftAnswers = d.a;
          setA((prev) => ({ ...prev, ...draftAnswers }));
          if (d.nums && typeof d.nums === "object") {
            const draftNums = d.nums;
            setNums((prev) => ({ ...prev, ...draftNums }));
          }
          if (d.pending && typeof d.pending === "object") {
            const draftPending = d.pending;
            setPending((prev) => ({ ...prev, ...draftPending }));
          }
          if (typeof d.step === "number" && d.step >= 0 && d.step < STEP_COUNT) setStep(d.step);
          setRestored(true);
        } else {
          window.sessionStorage.removeItem(DRAFT_KEY);
        }
      }
    } catch {
      // Storage blocked or the draft is malformed: start from what we have.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const unchanged =
        JSON.stringify({ a, nums, pending }) ===
        JSON.stringify({ a: answersFrom(initial), nums: numsFrom(initial), pending: EMPTY_PENDING });
      if (unchanged) {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } else {
        const d: Draft = { a, nums, pending, step, savedAt: Date.now() };
        window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
      }
    } catch {
      // Not fatal; the answers are still in memory.
    }
  }, [hydrated, initial, a, nums, pending, step]);

  function discardDraft() {
    setA(answersFrom(initial));
    setNums(numsFrom(initial));
    setPending(EMPTY_PENDING);
    setErrors({});
    setSaveError(null);
    setRestored(false);
    setStep(0);
  }

  // Move focus to the new step's heading so screen readers announce it and
  // keyboard users don't start from the bottom of the previous step.
  useEffect(() => {
    if (isFirstStepRender.current) {
      isFirstStepRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  // Pull what Swiggy already knows so we don't ask for it: saved addresses, and
  // dishes they actually order (offered as suggestions, never auto-applied).
  const [ctxAttempt, setCtxAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setCtxState("loading");
    (async () => {
      try {
        const res = await fetch("/api/swiggy/context");
        if (!res.ok) throw new Error("context unavailable");
        const data: SwiggyContext = await res.json();
        if (cancelled) return;
        setCtx(data);
        setCtxState("ready");
        // Single saved address is not a choice worth making them make.
        if (data.addresses.length === 1) {
          setA((prev) =>
            prev.defaultAddressId
              ? prev
              : { ...prev, defaultAddressId: data.addresses[0].id, defaultAddressLabel: data.addresses[0].addressLine }
          );
        }
      } catch {
        if (!cancelled) {
          setCtx((prev) => prev ?? { addresses: [], frequentItems: [], frequentRestaurants: [] });
          setCtxState("failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctxAttempt]);

  // A dish can't both spike you and sit well, so marking one clears the other.
  const markFood = (k: ListKey, value: string) =>
    setA((prev) => {
      const other: ListKey = k === "triggers" ? "safeFoods" : "triggers";
      const on = prev[k].includes(value);
      return {
        ...prev,
        [k]: on ? prev[k].filter((x) => x !== value) : [...prev[k], value],
        [other]: on ? prev[other] : prev[other].filter((x) => x !== value)
      };
    });

  const toggle = (k: "dietary" | "blocklist", value: string) =>
    setA((prev) => ({
      ...prev,
      [k]: prev[k].includes(value) ? prev[k].filter((x) => x !== value) : [...prev[k], value]
    }));

  function validateStep(i: number): Errors {
    const id = STEPS[i];
    const errs: Errors = {};
    if (id === "name" && a.displayName.trim().length === 0) {
      errs.displayName = "Add a name so GlycoCart knows how to greet you. A nickname is fine.";
    }
    for (const k of NUM_KEYS) {
      if (FIELD_STEP[k] !== id) continue;
      const msg = validateNumber(k, nums[k]);
      if (msg) errs[k] = msg;
    }
    return errs;
  }

  function focusField(k: FieldKey) {
    // After the step has rendered, so the field exists.
    window.setTimeout(() => document.getElementById(fieldId(k))?.focus(), 0);
  }

  function showErrorsAt(errs: Errors) {
    setErrors((prev) => ({ ...prev, ...errs }));
    const first = (Object.keys(errs) as FieldKey[])
      .map((k) => ({ k, i: stepIndex(FIELD_STEP[k]) }))
      .sort((x, y) => x.i - y.i)[0];
    if (!first) return;
    if (first.i !== step) setStep(first.i);
    focusField(first.k);
  }

  function onNext(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const errs = validateStep(step);
    if (Object.keys(errs).length > 0) return showErrorsAt(errs);
    if (step < STEP_COUNT - 1) setStep(step + 1);
    else void submit();
  }

  function goBack() {
    // Never validates: going back must not trap someone behind a half-typed value.
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    // Re-check every step: a value fixed on one step may have been broken later.
    const all: Errors = {};
    for (let i = 0; i < STEP_COUNT; i++) Object.assign(all, validateStep(i));
    if (Object.keys(all).length > 0) return showErrorsAt(all);

    const withPending = (list: string[], draft: string) => {
      const v = draft.trim();
      return v && !list.includes(v) ? [...list, v] : list;
    };
    const payload: CalibrationAnswers = {
      ...a,
      displayName: a.displayName.trim(),
      hba1c: toNumber(nums.hba1c),
      fastingGlucose: toNumber(nums.fastingGlucose),
      age: toNumber(nums.age),
      heightCm: toNumber(nums.heightCm),
      weightKg: toNumber(nums.weightKg),
      triggers: withPending(a.triggers, pending.triggers),
      safeFoods: withPending(a.safeFoods, pending.safeFoods)
    };

    setSaving(true);
    setSaveError(null);
    let res: Response;
    try {
      res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {
      setSaving(false);
      setSaveError({
        message: "Couldn't reach GlycoCart. Check your connection and try again. Your answers are still here."
      });
      return;
    }

    if (res.ok) {
      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // Nothing to clean up if storage is blocked.
      }
      router.push(isEditing ? "/profile" : "/chat");
      router.refresh();
      return;
    }

    const body: { error?: string; detail?: string; issues?: Record<string, string[] | undefined> } = await res
      .json()
      .catch(() => ({}));
    setSaving(false);

    if (res.status === 401) {
      setSaveError({
        message:
          "Your Swiggy sign-in has expired. Sign in again in this tab and come back here. Your answers are kept for 30 minutes.",
        signIn: true
      });
      return;
    }

    if (res.status === 400 && body.issues) {
      const errs: Errors = {};
      for (const [k, msgs] of Object.entries(body.issues)) {
        if (k in FIELD_STEP) errs[k as FieldKey] = `This wasn't accepted: ${msgs?.[0] ?? "check the value"}.`;
      }
      if (Object.keys(errs).length > 0) {
        setSaveError({ message: "One answer needs a change before it can be saved." });
        return showErrorsAt(errs);
      }
    }

    setSaveError({
      message: `${body.error ?? "Couldn't save your profile."} Your answers are still here, so you can try again.`,
      detail: body.detail
    });
  }

  const current = STEPS[step];
  const isLast = step === STEP_COUNT - 1;
  const bodyMetricsCount = [nums.age, nums.heightCm, nums.weightKg].filter((v) => v.trim() !== "").length;
  const addressCount = ctx?.addresses.length ?? 0;

  return (
    <form noValidate onSubmit={onNext} className="max-w-2xl mx-auto w-full">
      {/* Progress */}
      <div className="mb-8">
        <p className="text-sm text-ink-muted mb-2" aria-hidden="true">
          Step {step + 1} of {STEP_COUNT}
        </p>
        <div
          role="progressbar"
          aria-label="Profile setup"
          aria-valuemin={1}
          aria-valuemax={STEP_COUNT}
          aria-valuenow={step + 1}
          aria-valuetext={`Step ${step + 1} of ${STEP_COUNT}`}
          className="flex items-center gap-1.5"
        >
          {STEPS.map((id, i) => (
            <div
              key={id}
              className={cn("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-swiggy" : "bg-ink/10")}
            />
          ))}
        </div>
      </div>

      {restored && (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-ink/10 bg-cream-warm px-4 py-2"
          role="status"
        >
          <p className="text-sm text-ink-soft">Picked up the answers you hadn&apos;t saved yet.</p>
          <button type="button" onClick={discardDraft} className="btn-ghost min-h-11 -mr-3">
            {isEditing ? "Discard changes" : "Start over"}
          </button>
        </div>
      )}

      {current === "name" && (
        <Section
          headingRef={headingRef}
          step={step}
          title="What should we call you?"
          sub="Only used to greet you in the app. Nothing here is shared with Swiggy."
        >
          <div>
            <label htmlFor={fieldId("displayName")} className="section-label block mb-1.5">
              First name or nickname
            </label>
            <input
              id={fieldId("displayName")}
              autoFocus
              value={a.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              autoComplete="given-name"
              autoCapitalize="words"
              enterKeyHint="next"
              maxLength={60}
              aria-invalid={errors.displayName ? true : undefined}
              aria-describedby={errors.displayName ? `${fieldId("displayName")}-error` : undefined}
              className={inputClass(Boolean(errors.displayName))}
            />
            <FieldError id={`${fieldId("displayName")}-error`} message={errors.displayName} />
          </div>
        </Section>
      )}

      {current === "condition" && (
        <Section
          headingRef={headingRef}
          step={step}
          title="What are you managing?"
          sub="This sets the starting point for your estimates. It does not diagnose anything, and GlycoCart is not medical advice."
        >
          <div role="group" aria-label="What are you managing?" className="grid gap-2">
            {CONDITIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={a.condition === c.id}
                onClick={() => set("condition", c.id)}
                className={cn(
                  "text-left rounded-xl border px-4 py-3 min-h-11 transition-colors flex items-start gap-3",
                  a.condition === c.id
                    ? "border-leaf bg-leaf-pale/40"
                    : "border-ink/10 bg-cream-warm hover:bg-cream-deep"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-sm">{c.label}</span>
                  <span className="block text-ink-muted text-sm mt-0.5">{c.blurb}</span>
                </span>
                {a.condition === c.id && <Check size={16} className="text-leaf-text mt-0.5 shrink-0" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </Section>
      )}

      {current === "address" && (
        <Section
          headingRef={headingRef}
          step={step}
          title="Where should we look for food?"
          sub="These are the addresses saved on your Swiggy account. Picking one now means we never have to interrupt you to ask later."
        >
          {ctxState === "loading" && (
            <p className="flex items-center gap-2 text-ink-muted text-sm" role="status">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Reading your saved addresses…
            </p>
          )}

          {ctxState === "failed" && addressCount === 0 && (
            <div className="rounded-xl border border-ember/30 bg-ember-soft/20 p-4" role="alert">
              <p className="text-sm text-ink-soft leading-relaxed">
                Couldn&apos;t read your addresses from Swiggy just now. Try again, or carry on
                and pick one later in Settings.
              </p>
              <button
                type="button"
                onClick={() => setCtxAttempt((n) => n + 1)}
                className="btn-ghost min-h-11 mt-2 -ml-3 text-ink"
              >
                <RefreshCw size={14} aria-hidden="true" /> Try again
              </button>
            </div>
          )}

          {ctxState === "ready" && addressCount === 0 && (
            <div className="rounded-xl border border-ember/30 bg-ember-soft/20 p-4">
              <p className="text-sm text-ink-soft leading-relaxed">
                Your Swiggy account has no saved addresses. Restaurant search needs one,
                so add an address in the Swiggy app. You can finish here and pick it
                later in Settings.
              </p>
            </div>
          )}

          {addressCount > 0 && (
            <div role="group" aria-label="Delivery address" className="grid gap-2">
              {ctx!.addresses.map((addr) => (
                <button
                  key={addr.id}
                  type="button"
                    aria-pressed={a.defaultAddressId === addr.id}
                  onClick={() =>
                    setA((prev) => ({ ...prev, defaultAddressId: addr.id, defaultAddressLabel: addr.addressLine }))
                  }
                  className={cn(
                    "text-left rounded-xl border px-4 py-3 min-h-11 transition-colors flex items-start gap-3",
                    a.defaultAddressId === addr.id
                      ? "border-leaf bg-leaf-pale/40"
                      : "border-ink/10 bg-cream-warm hover:bg-cream-deep"
                  )}
                >
                  <MapPin size={15} className="text-ink-muted mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    {(addr.tag || addr.category) && (
                      <span className="section-label block mb-0.5">
                        {[addr.tag, addr.category].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    <span className="block text-sm line-clamp-2">{addr.addressLine}</span>
                  </span>
                  {a.defaultAddressId === addr.id && (
                    <Check size={16} className="text-leaf-text mt-0.5 shrink-0" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      {current === "labs" && (
        <Section
          headingRef={headingRef}
          step={step}
          title="Do you know any recent lab values?"
          sub="Optional. Leave both blank and we start from a typical value for your condition."
        >
          <NumberField
            id={fieldId("hba1c")}
            label="HbA1c (%)"
            hint="From a blood test in the last three months, for example 5.8"
            value={nums.hba1c}
            error={errors.hba1c}
            inputMode="decimal"
            onChange={(v) => {
              setNums((p) => ({ ...p, hba1c: v }));
              clearError("hba1c");
            }}
            onBlur={() => {
              const msg = validateNumber("hba1c", nums.hba1c);
              if (msg) setErrors((p) => ({ ...p, hba1c: msg }));
            }}
          />
          <NumberField
            id={fieldId("fastingGlucose")}
            label="Fasting glucose (mg/dL)"
            hint="A morning reading before eating, for example 95"
            value={nums.fastingGlucose}
            error={errors.fastingGlucose}
            inputMode="decimal"
            onChange={(v) => {
              setNums((p) => ({ ...p, fastingGlucose: v }));
              clearError("fastingGlucose");
            }}
            onBlur={() => {
              const msg = validateNumber("fastingGlucose", nums.fastingGlucose);
              if (msg) setErrors((p) => ({ ...p, fastingGlucose: msg }));
            }}
          />
          <p className="text-sm text-ink-muted leading-relaxed">
            Fasting glucose becomes your baseline directly. An HbA1c on its own is
            converted with the ADA average-glucose formula, and it also nudges how
            strongly carbs are expected to affect you. Either way the result is an
            estimate, not a measurement.
          </p>
        </Section>
      )}

      {current === "behaviour" && (
        <Section
          headingRef={headingRef}
          step={step}
          title="How does your body usually behave?"
          sub="This shapes how sharply we expect carbs to hit you. The middle answers are already picked; change any that don't fit."
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
            label="How active are you?"
            value={a.activity}
            onChange={(v) => set("activity", v)}
            options={[
              { value: "sedentary", label: "Mostly sitting" },
              { value: "light", label: "Light" },
              { value: "moderate", label: "Moderate" },
              { value: "very", label: "Very active" }
            ]}
          />
          <Choice
            label="What's your goal?"
            value={a.goal}
            onChange={(v) => set("goal", v)}
            options={[
              { value: "lose", label: "Lose weight" },
              { value: "maintain", label: "Maintain" },
              { value: "gain", label: "Gain weight" }
            ]}
          />
        </Section>
      )}

      {current === "basics" && (
        <Section
          headingRef={headingRef}
          step={step}
          title="A few body basics"
          sub="Only used to set a daily calorie target, with the Mifflin-St Jeor equation. Skip them and the target is 2,000 kcal to maintain, 1,700 to lose or 2,400 to gain, which you can change later."
        >
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { k: "age", label: "Age (years)", inputMode: "numeric" },
                { k: "weightKg", label: "Weight (kg)", inputMode: "decimal" },
                { k: "heightCm", label: "Height (cm)", inputMode: "decimal" }
              ] as const
            ).map(({ k, label, inputMode }) => (
              <NumberField
                key={k}
                id={fieldId(k)}
                label={label}
                value={nums[k]}
                error={errors[k]}
                inputMode={inputMode}
                onChange={(v) => {
                  setNums((p) => ({ ...p, [k]: v }));
                  clearError(k);
                }}
                onBlur={() => {
                  const msg = validateNumber(k, nums[k]);
                  if (msg) setErrors((p) => ({ ...p, [k]: msg }));
                }}
              />
            ))}
            <div>
              <label htmlFor={fieldId("sex")} className="section-label block mb-1.5">
                Sex
              </label>
              <select
                id={fieldId("sex")}
                value={a.sex}
                onChange={(e) => set("sex", e.target.value as CalibrationAnswers["sex"])}
                className={inputClass(false)}
              >
                <option value="unspecified">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
          </div>
          {bodyMetricsCount > 0 && bodyMetricsCount < 3 && (
            <p className="text-sm text-ink-muted leading-relaxed">
              The calculation needs all three of age, weight and height. With only{" "}
              {bodyMetricsCount === 1 ? "one" : "two"}, the default target above is used.
            </p>
          )}
        </Section>
      )}

      {current === "food" && (
        <Section
          headingRef={headingRef}
          step={step}
          title="Food preferences"
          sub="What you eat, what you avoid, and anything you already know spikes you. All optional."
        >
          <ChipGroup
            label="Dietary preferences"
            options={DIETARY_OPTIONS}
            selected={a.dietary}
            onToggle={(v) => toggle("dietary", v)}
          />
          <ChipGroup
            label="Foods to avoid"
            options={COMMON_AVOIDS}
            selected={a.blocklist}
            onToggle={(v) => toggle("blocklist", v)}
          />
          {(ctx?.frequentItems.length ?? 0) > 0 && (
            <div className="rounded-xl border border-ink/10 bg-cream-warm p-4">
              <p className="section-label mb-1">From your recent Swiggy orders</p>
              <p className="text-sm text-ink-muted mb-3 leading-relaxed">
                Mark anything that reliably spikes you, or that always sits well. We
                can&apos;t tell from an order how it affected your glucose. Only you know that.
              </p>
              <ul className="space-y-2">
                {ctx!.frequentItems.map((item) => {
                  const isTrigger = a.triggers.includes(item);
                  const isSafe = a.safeFoods.includes(item);
                  return (
                    <li key={item} className="flex items-center gap-2">
                      <span className="flex-1 min-w-0 text-sm truncate">{item}</span>
                      <button
                        type="button"
                        onClick={() => markFood("safeFoods", item)}
                        aria-pressed={isSafe}
                        aria-label={`${item} sits well`}
                        className={cn(
                          "min-h-11 rounded-full border px-3 text-sm transition-colors shrink-0",
                          isSafe
                            ? "border-leaf bg-leaf-pale text-leaf-text"
                            : "border-ink/10 text-ink-muted hover:bg-cream-deep"
                        )}
                      >
                        Sits well
                      </button>
                      <button
                        type="button"
                        onClick={() => markFood("triggers", item)}
                        aria-pressed={isTrigger}
                        aria-label={`${item} spikes me`}
                        className={cn(
                          "min-h-11 rounded-full border px-3 text-sm transition-colors shrink-0",
                          isTrigger
                            ? "border-ember/40 bg-ember-soft/40 text-ember-text"
                            : "border-ink/10 text-ink-muted hover:bg-cream-deep"
                        )}
                      >
                        Spikes
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <FreeList
            label="Foods you know spike you"
            hint="For example white rice, chole bhature"
            values={a.triggers}
            draft={pending.triggers}
            onDraft={(v) => setPending((p) => ({ ...p, triggers: v }))}
            onChange={(v) => set("triggers", v)}
          />
          <FreeList
            label="Foods that always sit well"
            hint="For example dal, ragi roti"
            values={a.safeFoods}
            draft={pending.safeFoods}
            onDraft={(v) => setPending((p) => ({ ...p, safeFoods: v }))}
            onChange={(v) => set("safeFoods", v)}
          />
          <p className="text-sm text-ink-muted leading-relaxed">
            You can change any answer later from Profile. Saving builds estimates
            only; it does not order anything.
          </p>
        </Section>
      )}

      {saveError && (
        <div className="mt-6 rounded-xl border border-ember/30 bg-ember-soft/20 p-4" role="alert">
          <p className="text-sm text-ink-soft leading-relaxed">{saveError.message}</p>
          {saveError.detail && (
            // The server's own reason, kept so a misconfigured deployment is diagnosable.
            <p className="text-xs text-ink-muted mt-2 break-words font-mono">{saveError.detail}</p>
          )}
          {saveError.signIn && (
            <a href="/api/auth/swiggy/login" className="btn-ghost min-h-11 mt-2 -ml-3 text-ink underline underline-offset-2">
              Sign in with Swiggy again
            </a>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-10">
        {step > 0 ? (
          <button type="button" onClick={goBack} className="btn-ghost min-h-11">
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
        ) : (
          <span />
        )}

        <button
          type="submit"
          disabled={saving}
          aria-busy={saving || undefined}
          className="btn-swiggy min-h-11 py-3 disabled:opacity-60"
        >
          {isLast ? (
            <>
              {saving ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Check size={16} aria-hidden="true" />
              )}
              {saving ? "Saving…" : saveError ? "Try saving again" : isEditing ? "Save changes" : "Build my profile"}
            </>
          ) : (
            <>
              {current === "labs" && !nums.hba1c.trim() && !nums.fastingGlucose.trim() ? "Skip" : "Continue"}
              <ArrowRight size={16} aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function inputClass(invalid: boolean) {
  // text-base, not text-sm: iOS Safari zooms the page on focus below 16px.
  return cn(
    "w-full min-h-11 bg-cream-warm border rounded-xl px-4 py-2.5 text-base outline-none focus:border-leaf",
    invalid ? "border-ember" : "border-ink/10"
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-ember-text mt-1.5 leading-snug">
      {message}
    </p>
  );
}

function Section({
  headingRef,
  step,
  title,
  sub,
  children
}: {
  headingRef: Ref<HTMLHeadingElement>;
  step: number;
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="display text-3xl mb-2 outline-none">
        <span className="sr-only">
          Step {step + 1} of {STEP_COUNT}.{" "}
        </span>
        {title}
      </h2>
      <p className="text-ink-muted text-sm mb-7 leading-relaxed">{sub}</p>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function NumberField({
  id,
  label,
  hint,
  value,
  error,
  inputMode,
  onChange,
  onBlur
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  error?: string;
  inputMode: "decimal" | "numeric";
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="section-label block mb-1.5">
        {label}
      </label>
      {/* type="text" with inputMode: type="number" silently drops "5,8" and
          lets a scroll wheel change a lab value. */}
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        enterKeyHint="next"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClass(Boolean(error))}
      />
      {hint && (
        <p id={hintId} className="text-sm text-ink-muted mt-1">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const labelId = useId();
  return (
    <div>
      <p id={labelId} className="section-label mb-2">
        {label}
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm transition-colors",
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
  label,
  options,
  selected,
  onToggle
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  const labelId = useId();
  return (
    <div>
      <p id={labelId} className="section-label mb-2">
        {label}
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(o)}
              className={cn(
                "min-h-11 inline-flex items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
                on ? "border-leaf bg-leaf-pale/50 text-ink" : "border-ink/10 bg-cream-warm hover:bg-cream-deep text-ink-soft"
              )}
            >
              {on && <Check size={13} aria-hidden="true" />}
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FreeList({
  label,
  hint,
  values,
  draft,
  onDraft,
  onChange
}: {
  label: string;
  hint: string;
  values: string[];
  draft: string;
  onDraft: (v: string) => void;
  onChange: (v: string[]) => void;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    onDraft("");
  };

  return (
    <div>
      <label htmlFor={inputId} className="section-label block mb-2">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Enter adds the food rather than submitting the step.
              e.preventDefault();
              add();
            }
          }}
          maxLength={40}
          enterKeyHint="done"
          aria-describedby={hintId}
          className={cn(inputClass(false), "flex-1 w-auto min-w-0")}
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center justify-center size-11 shrink-0 rounded-xl border border-ink/10 bg-cream-warm hover:bg-cream-deep transition-colors"
          aria-label={`Add to ${label.toLowerCase()}`}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <p id={hintId} className="text-sm text-ink-muted mt-1">
        {hint}
      </p>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2 mt-2" aria-label={label}>
          {values.map((v) => (
            <li key={v}>
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
                className="min-h-11 inline-flex items-center gap-1.5 rounded-full bg-leaf-pale/50 border border-leaf/20 px-3.5 text-sm hover:bg-leaf-pale transition-colors"
              >
                {v}
                <X size={13} className="text-ink-muted" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
