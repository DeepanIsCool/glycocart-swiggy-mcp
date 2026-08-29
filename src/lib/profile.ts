/**
 * A real user's metabolic profile, built during onboarding.
 *
 * IMPORTANT — the numbers derived here are heuristics built on population
 * priors plus one genuine clinical relationship (the ADA eAG formula). They
 * are NOT a clinical calibration and must never be presented as one. Every
 * derived value ships with a plain-English `derivation` line so the user can
 * see exactly what produced it, and the UI shows those lines.
 */

export type ConditionId = "general" | "pcos" | "pcos_ir" | "prediabetes" | "t2d";
export type CrashFrequency = "never" | "sometimes" | "often";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "very";
export type Goal = "lose" | "maintain" | "gain";
export type Sex = "female" | "male" | "unspecified";

export const CONDITIONS: { id: ConditionId; label: string; blurb: string }[] = [
  { id: "pcos_ir", label: "PCOS with insulin resistance", blurb: "Diagnosed PCOS, and told you have insulin resistance" },
  { id: "pcos", label: "PCOS", blurb: "Diagnosed PCOS, no insulin resistance diagnosis" },
  { id: "prediabetes", label: "Prediabetes", blurb: "HbA1c between 5.7 and 6.4, or told you're prediabetic" },
  { id: "t2d", label: "Type 2 diabetes", blurb: "Diagnosed type 2 diabetes" },
  { id: "general", label: "General metabolic health", blurb: "No diagnosis — you just want steadier energy" }
];

export interface CalibrationAnswers {
  displayName: string;
  condition: ConditionId;
  /** Optional lab values — strongest signal when present. */
  hba1c?: number;
  fastingGlucose?: number;
  crashes: CrashFrequency;
  activity: ActivityLevel;
  goal: Goal;
  /** Optional body metrics for the calorie target. */
  age?: number;
  sex?: Sex;
  heightCm?: number;
  weightKg?: number;
  dietary: string[];
  blocklist: string[];
  triggers: string[];
  safeFoods: string[];
}

export interface MetabolicProfile {
  /** Personal fasting baseline in mg/dL — the floor of every predicted curve. */
  fastingBaseline: number;
  insulinSensitivity: number;
  baselineAUC: number;
  triggers: string[];
  safeFoods: string[];
  /** Human-readable account of how the numbers above were arrived at. */
  derivation: string[];
}

export interface UserProfile {
  id: string;
  displayName: string;
  condition: ConditionId;
  conditionLabel: string;
  goal: Goal;
  dietary: string[];
  blocklist: string[];
  dailyCalTarget: number;
  metabolic: MetabolicProfile;
  answers: CalibrationAnswers;
  updatedAt: string;
}

const CONDITION_PRIORS: Record<ConditionId, { sensitivity: number; fasting: number }> = {
  general: { sensitivity: 0.45, fasting: 88 },
  pcos: { sensitivity: 0.55, fasting: 92 },
  pcos_ir: { sensitivity: 0.62, fasting: 95 },
  prediabetes: { sensitivity: 0.72, fasting: 105 },
  t2d: { sensitivity: 0.85, fasting: 120 }
};

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** ADA estimated average glucose from HbA1c: eAG(mg/dL) = 28.7 × A1c − 46.7. */
export function eagFromHba1c(hba1c: number): number {
  return 28.7 * hba1c - 46.7;
}

export function deriveMetabolicProfile(a: CalibrationAnswers): MetabolicProfile {
  const prior = CONDITION_PRIORS[a.condition] ?? CONDITION_PRIORS.general;
  const derivation: string[] = [];

  // --- Fasting baseline -----------------------------------------------------
  let fastingBaseline: number;
  if (typeof a.fastingGlucose === "number" && a.fastingGlucose > 0) {
    fastingBaseline = a.fastingGlucose;
    derivation.push(`Fasting baseline ${Math.round(fastingBaseline)} mg/dL — the value you entered.`);
  } else if (typeof a.hba1c === "number" && a.hba1c > 0) {
    fastingBaseline = eagFromHba1c(a.hba1c);
    derivation.push(
      `Fasting baseline ${Math.round(fastingBaseline)} mg/dL — estimated from your HbA1c of ${a.hba1c}% using the ADA average-glucose formula.`
    );
  } else {
    fastingBaseline = prior.fasting;
    derivation.push(
      `Fasting baseline ${fastingBaseline} mg/dL — a typical starting value for your condition, not a measurement. Add a lab value to sharpen this.`
    );
  }
  fastingBaseline = clamp(fastingBaseline, 70, 200);

  // --- Insulin sensitivity --------------------------------------------------
  let sensitivity = prior.sensitivity;
  const reasons: string[] = [`your stated condition`];

  if (a.crashes === "often") {
    sensitivity += 0.06;
    reasons.push("frequent post-meal crashes");
  } else if (a.crashes === "sometimes") {
    sensitivity += 0.03;
    reasons.push("occasional post-meal crashes");
  }

  if (a.activity === "very") {
    sensitivity -= 0.06;
    reasons.push("high activity level");
  } else if (a.activity === "moderate") {
    sensitivity -= 0.03;
    reasons.push("moderate activity level");
  } else if (a.activity === "sedentary") {
    sensitivity += 0.03;
    reasons.push("sedentary activity level");
  }

  if (typeof a.hba1c === "number") {
    if (a.hba1c >= 6.5) {
      sensitivity += 0.05;
      reasons.push(`HbA1c ${a.hba1c}%`);
    } else if (a.hba1c >= 5.7) {
      sensitivity += 0.03;
      reasons.push(`HbA1c ${a.hba1c}%`);
    }
  }

  sensitivity = clamp(Number(sensitivity.toFixed(3)), 0.35, 1.1);
  derivation.push(
    `Carb sensitivity ${sensitivity} — a population starting point based on ${reasons.join(", ")}. Higher means carbs raise your glucose faster.`
  );

  // --- Baseline AUC ---------------------------------------------------------
  // Calibrated so this reproduces the previously hand-tuned reference profiles.
  const baselineAUC = Math.round(fastingBaseline * sensitivity * 143);
  derivation.push(
    `Typical 3-hour glucose load ${baselineAUC} — computed from your baseline and carb sensitivity; used to score how well a dish fits you.`
  );

  derivation.push("These are estimates, not clinical measurements. Connect a CGM later to replace them with your real data.");

  return {
    fastingBaseline: Math.round(fastingBaseline),
    insulinSensitivity: sensitivity,
    baselineAUC,
    triggers: a.triggers.filter(Boolean),
    safeFoods: a.safeFoods.filter(Boolean),
    derivation
  };
}

/** Mifflin-St Jeor BMR × activity, nudged by the stated goal. */
export function deriveCalorieTarget(a: CalibrationAnswers): number {
  const { age, sex, heightCm, weightKg, activity, goal } = a;
  if (!age || !heightCm || !weightKg) {
    // No body metrics given — a sane, editable default rather than a fake number.
    return goal === "lose" ? 1700 : goal === "gain" ? 2400 : 2000;
  }
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmr = sex === "male" ? base + 5 : sex === "female" ? base - 161 : base - 78;
  const tdee = bmr * (ACTIVITY_FACTOR[activity] ?? 1.375);
  const adjusted = goal === "lose" ? tdee * 0.85 : goal === "gain" ? tdee * 1.1 : tdee;
  return Math.round(clamp(adjusted, 1200, 4000) / 50) * 50;
}

export function buildUserProfile(id: string, a: CalibrationAnswers): UserProfile {
  return {
    id,
    displayName: a.displayName.trim() || "there",
    condition: a.condition,
    conditionLabel: CONDITIONS.find((c) => c.id === a.condition)?.label ?? "Metabolic health",
    goal: a.goal,
    dietary: a.dietary.filter(Boolean),
    blocklist: a.blocklist.filter(Boolean),
    dailyCalTarget: deriveCalorieTarget(a),
    metabolic: deriveMetabolicProfile(a),
    answers: a,
    updatedAt: new Date().toISOString()
  };
}
