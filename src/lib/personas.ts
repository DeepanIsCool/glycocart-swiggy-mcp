/**
 * Mock personas for the demo.
 * In production, these are constructed from CGM data + onboarding questionnaire,
 * stored encrypted with per-user keys (DPDP-compliant).
 */

export type PersonaId = "pcos" | "cgm";

export interface MetabolicProfile {
  /** Average post-prandial glucose AUC (mg·dL·min) — derived from CGM history */
  baselineAUC: number;
  /** Personal insulin sensitivity (lower = more sensitive to carbs) */
  insulinSensitivity: number;
  /** Foods that consistently spike this user > 2 SD above baseline */
  triggers: string[];
  /** Foods that consistently keep glucose flat for this user */
  safeFoods: string[];
}

export interface Persona {
  id: PersonaId;
  name: string;
  age: number;
  city: string;
  condition: string;
  goals: string[];
  dietary: string[];
  blocklist: string[];
  dailyCalTarget: number;
  metabolic: MetabolicProfile;
  /** What the user "tells" the agent — sets system prompt context */
  agentContext: string;
}

export const PERSONAS: Record<PersonaId, Persona> = {
  pcos: {
    id: "pcos",
    name: "Priya",
    age: 29,
    city: "Bengaluru",
    condition: "PCOS with insulin resistance",
    goals: ["Regulate menstrual cycle", "Reduce afternoon crashes", "Lose 4kg"],
    dietary: ["Low GI", "High fiber", "Anti-inflammatory"],
    blocklist: ["Refined sugar", "White rice", "Maida", "Excessive dairy"],
    dailyCalTarget: 1600,
    metabolic: {
      baselineAUC: 8400,
      insulinSensitivity: 0.62,
      triggers: ["white rice", "naan", "sweetened lassi", "jalebi", "biryani (basmati)"],
      safeFoods: ["dal", "ragi roti", "paneer tikka", "raita", "millet khichdi"]
    },
    agentContext:
      "User has PCOS with documented insulin resistance. Optimize for glycemic load < 18 per meal, " +
      "fiber > 8g, protein > 25g. Avoid refined carbs, prioritize millets, lentils, and non-starchy vegetables."
  },
  cgm: {
    id: "cgm",
    name: "Arjun",
    age: 34,
    city: "Mumbai",
    condition: "Prediabetic, active CGM (Ultrahuman M1)",
    goals: ["Reverse prediabetes", "Cap post-meal spike < 140 mg/dL", "Maintain muscle mass"],
    dietary: ["Mediterranean-Indian", "Time-restricted (12pm–8pm)"],
    blocklist: ["Sugary drinks", "Deep-fried", "Refined flour"],
    dailyCalTarget: 2200,
    metabolic: {
      baselineAUC: 11200,
      insulinSensitivity: 0.78,
      triggers: ["chole bhature", "pav bhaji", "sweet lassi", "white pasta", "fruit juice"],
      safeFoods: ["grilled chicken", "quinoa pulao", "stir-fried tofu", "greek salad", "rajma"]
    },
    agentContext:
      "User wears Ultrahuman M1 CGM. 14-day data shows post-meal spikes correlate with refined carbs and " +
      "specific Indian breads. Prioritize meals with predicted peak glucose < 140 mg/dL. User has logged " +
      "sensitivity to chole bhature and sweet lassi (>180 mg/dL spikes)."
  }
};
