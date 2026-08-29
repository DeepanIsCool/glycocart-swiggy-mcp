import type { Dish } from "./catalog";
import type { UserProfile } from "./profile";

/**
 * Personal glycemic prediction.
 *
 * In production: gradient-boosted model trained on (user_id, food_vector, time_of_day,
 * prior_activity, sleep_score) → AUC + peak. See methodology in:
 *   Berry et al. PREDICT-1 (Nat Med, 2020)
 *   Mendes-Soares et al. (JAMA Netw Open, 2019)
 *
 * Demo version: closed-form approximation using glycemic load + persona modifiers.
 * Calibrated to produce realistic curves resembling real CGM traces.
 */

export interface GlucosePrediction {
  /** Peak glucose value (mg/dL) */
  peakMgDl: number;
  /** Time to peak (minutes after meal) */
  timeToPeakMin: number;
  /** Area under the curve over 3 hours (mg·dL·min) */
  auc: number;
  /** 0–100 score; higher = better fit for this user */
  matchScore: number;
  /** Sampled curve for charting: 18 points over 180 min */
  curve: { t: number; mgDl: number }[];
  /** Human-readable verdict */
  verdict: "excellent" | "good" | "moderate" | "poor";
}

export function predictGlucoseResponse(dish: Dish, profile: UserProfile): GlucosePrediction {
  const { metabolic } = profile;
  // Per-user fasting baseline, set during onboarding from a stated lab value,
  // an HbA1c-derived estimate, or a condition-level starting point.
  const FASTING_BASELINE = metabolic.fastingBaseline;

  // Base spike from glycemic load, scaled by personal insulin sensitivity
  const sensitivityFactor = metabolic.insulinSensitivity;
  let baseSpike = dish.gl * 1.6 * sensitivityFactor;

  // Fiber dampens the spike (each gram of fiber reduces ~3% of peak)
  baseSpike *= Math.max(0.55, 1 - dish.fiber * 0.03);

  // Protein + fat slow gastric emptying → flatter, slower peak
  const slowingFactor = (dish.protein + dish.fat * 0.5) / 30;
  const timeToPeak = 35 + Math.min(50, slowingFactor * 18);

  // Trigger food penalty: if dish name contains a trigger, amplify
  const dishNameLower = dish.name.toLowerCase();
  const isTrigger = metabolic.triggers.some((t) => dishNameLower.includes(t.toLowerCase()));
  const isSafe = metabolic.safeFoods.some((s) => dishNameLower.includes(s.toLowerCase()));
  if (isTrigger) baseSpike *= 1.35;
  if (isSafe) baseSpike *= 0.78;

  const peak = FASTING_BASELINE + baseSpike;

  // Build curve: gaussian-like rise + slower exponential decay.
  // The rising limb is normalised so it starts exactly at the fasting baseline
  // at t=0; the raw gaussian is ~14% of the spike above baseline there, which
  // showed up as a curve that began above the user's own stated fasting value.
  const RISE_SHARPNESS = 1.4;
  const riseAtZero = Math.exp(-Math.pow(RISE_SHARPNESS, 2));
  const curve: { t: number; mgDl: number }[] = [];
  for (let t = 0; t <= 180; t += 10) {
    let val: number;
    if (t < timeToPeak) {
      const x = t / timeToPeak;
      const raw = Math.exp(-Math.pow((1 - x) * RISE_SHARPNESS, 2));
      val = FASTING_BASELINE + baseSpike * ((raw - riseAtZero) / (1 - riseAtZero));
    } else {
      const decay = (t - timeToPeak) / 80;
      val = FASTING_BASELINE + baseSpike * Math.exp(-decay);
    }
    curve.push({ t, mgDl: Math.round(val) });
  }

  // AUC (trapezoidal)
  let auc = 0;
  for (let i = 1; i < curve.length; i++) {
    auc += ((curve[i].mgDl + curve[i - 1].mgDl) / 2) * (curve[i].t - curve[i - 1].t);
  }
  auc -= FASTING_BASELINE * 180; // subtract baseline area → "delta AUC"

  // Match score: lower peak vs target = higher score
  const targetPeak = 140; // ADA recommends < 140 mg/dL post-prandial
  const peakPenalty = Math.max(0, peak - targetPeak) * 1.5;
  const aucPenalty = Math.max(0, auc / metabolic.baselineAUC - 1) * 35;
  const matchScore = Math.max(0, Math.min(100, Math.round(100 - peakPenalty - aucPenalty)));

  // Verdict blends the ABSOLUTE peak (ADA's <140 mg/dL post-prandial target)
  // with the RISE above this user's own baseline, taking the worse of the two.
  //
  // Absolute thresholds alone were useless for anyone with a low baseline: a
  // user at 88 mg/dL with low carb sensitivity got "excellent" for pizza,
  // biryani AND dessert, because nothing ever crossed 130. That is both
  // undiscriminating and actively misleading in a metabolic-health app.
  const rise = peak - FASTING_BASELINE;
  const band = (v: number, t: [number, number, number]) =>
    v < t[0] ? 0 : v < t[1] ? 1 : v < t[2] ? 2 : 3;
  const severity = Math.max(band(peak, [130, 145, 165]), band(rise, [15, 30, 45]));
  const verdict: GlucosePrediction["verdict"] = (
    ["excellent", "good", "moderate", "poor"] as const
  )[severity];

  return {
    peakMgDl: Math.round(peak),
    timeToPeakMin: Math.round(timeToPeak),
    auc: Math.round(auc),
    matchScore,
    curve,
    verdict
  };
}

/**
 * Rank dishes for a user — combines glycemic match with calorie target proximity.
 * Returns dishes sorted by overall fit.
 */
export function rankDishesForUser(
  dishes: Dish[],
  profile: UserProfile,
  opts: { mealTargetCal?: number } = {}
) {
  const target = opts.mealTargetCal ?? profile.dailyCalTarget / 3;
  return dishes
    .map((d) => {
      const pred = predictGlucoseResponse(d, profile);
      const calFit = 100 - Math.min(100, (Math.abs(d.calories - target) / target) * 100);
      const overallScore = pred.matchScore * 0.7 + calFit * 0.3;
      return { dish: d, prediction: pred, overallScore: Math.round(overallScore) };
    })
    .sort((a, b) => b.overallScore - a.overallScore);
}
