/**
 * Self-check for the onboarding → metabolic-model derivation.
 * These numbers drive every glucose curve the app shows, so the mapping is
 * pinned here: a silent change to a prior would silently change what a
 * diabetic user is told to eat.
 *
 * Run: npm run test:profile
 */
import assert from "node:assert";
import {
  eagFromHba1c,
  deriveMetabolicProfile,
  deriveCalorieTarget,
  buildUserProfile,
  type CalibrationAnswers
} from "./profile";

const base: CalibrationAnswers = {
  displayName: "Test",
  condition: "general",
  crashes: "never",
  activity: "light",
  goal: "maintain",
  dietary: [],
  blocklist: [],
  triggers: [],
  safeFoods: []
};

// --- ADA estimated-average-glucose formula --------------------------------
// Published reference points: 6% -> ~126 mg/dL, 7% -> ~154 mg/dL.
assert.ok(Math.abs(eagFromHba1c(6) - 126) < 1, `eAG(6%) should be ~126, got ${eagFromHba1c(6)}`);
assert.ok(Math.abs(eagFromHba1c(7) - 154) < 1, `eAG(7%) should be ~154, got ${eagFromHba1c(7)}`);

// --- Fasting baseline precedence: stated value beats HbA1c beats prior -----
const stated = deriveMetabolicProfile({ ...base, fastingGlucose: 101, hba1c: 9 });
assert.equal(stated.fastingBaseline, 101, "a stated fasting glucose must win over HbA1c");

const fromA1c = deriveMetabolicProfile({ ...base, hba1c: 6 });
assert.ok(Math.abs(fromA1c.fastingBaseline - 126) <= 1, "HbA1c should drive the baseline when no fasting value given");

const fromPrior = deriveMetabolicProfile(base);
assert.equal(fromPrior.fastingBaseline, 88, "no labs -> condition prior");

// --- Sensitivity responds to the calibration answers in the right direction
const sedentaryCrashy = deriveMetabolicProfile({ ...base, crashes: "often", activity: "sedentary" });
assert.ok(
  sedentaryCrashy.insulinSensitivity > fromPrior.insulinSensitivity,
  "frequent crashes + sedentary must raise carb sensitivity"
);
const athlete = deriveMetabolicProfile({ ...base, crashes: "never", activity: "very" });
assert.ok(
  athlete.insulinSensitivity < fromPrior.insulinSensitivity,
  "high activity must lower carb sensitivity"
);

// --- Clamping holds at both ends ------------------------------------------
const extreme = deriveMetabolicProfile({ ...base, condition: "t2d", crashes: "often", activity: "sedentary", hba1c: 11 });
assert.ok(extreme.insulinSensitivity <= 1.1, "sensitivity must clamp at the top");
assert.ok(extreme.fastingBaseline <= 200, "baseline must clamp at the top");
const floor = deriveMetabolicProfile({ ...base, condition: "general", activity: "very" });
assert.ok(floor.insulinSensitivity >= 0.35, "sensitivity must clamp at the bottom");

// --- Reproduces the previously hand-tuned reference profiles ---------------
// Guards against a prior change silently shifting everyone's curves.
const pcos = deriveMetabolicProfile({ ...base, condition: "pcos_ir" });
assert.ok(
  Math.abs(pcos.baselineAUC - 8400) < 500,
  `PCOS+IR baselineAUC should stay near the tuned 8400, got ${pcos.baselineAUC}`
);
const pre = deriveMetabolicProfile({ ...base, condition: "prediabetes" });
assert.ok(
  Math.abs(pre.baselineAUC - 11200) < 800,
  `prediabetic baselineAUC should stay near the tuned 11200, got ${pre.baselineAUC}`
);

// --- Every derived number is explained to the user ------------------------
assert.ok(pcos.derivation.length >= 3, "derivation must explain baseline, sensitivity and load");
assert.ok(
  pcos.derivation.some((d) => d.toLowerCase().includes("estimate")),
  "derivation must state plainly that these are estimates"
);

// --- Calorie target -------------------------------------------------------
const withBody = deriveCalorieTarget({ ...base, age: 29, sex: "female", heightCm: 165, weightKg: 62, activity: "light" });
assert.ok(withBody > 1500 && withBody < 2400, `Mifflin-St Jeor target out of sane range: ${withBody}`);
const noBody = deriveCalorieTarget({ ...base, goal: "lose" });
assert.equal(noBody, 1700, "missing body metrics should fall back to a sane editable default");
const losing = deriveCalorieTarget({ ...base, age: 29, sex: "female", heightCm: 165, weightKg: 62, goal: "lose" });
assert.ok(losing < withBody, "a weight-loss goal must lower the target");

// --- Whole-profile assembly ------------------------------------------------
const profile = buildUserProfile("uid-1", { ...base, displayName: "  Priya  ", condition: "pcos_ir", triggers: ["", "white rice"] });
assert.equal(profile.displayName, "Priya", "display name is trimmed");
assert.equal(profile.id, "uid-1");
assert.deepEqual(profile.metabolic.triggers, ["white rice"], "empty trigger entries are dropped");
assert.equal(profile.conditionLabel, "PCOS with insulin resistance");

console.log("profile: all checks passed");
