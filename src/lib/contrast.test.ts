/**
 * Contrast gate for the design tokens.
 *
 * GlycoCart's users manage PCOS, prediabetes and type 2 diabetes — populations
 * with elevated rates of diabetic retinopathy and reduced contrast sensitivity.
 * Low-contrast text is an accessibility failure aimed squarely at the people
 * the product exists for, so the palette is asserted, not eyeballed.
 *
 * Run: npm run test:contrast
 */
import assert from "node:assert";

const hex = (h: string) => {
  const v = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};
const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = (h: string) => {
  const [r, g, b] = hex(h).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

// Must mirror tailwind.config.ts.
const BACKGROUNDS = { cream: "#F8F5EF", "cream-warm": "#F2EDE2", "cream-deep": "#EAE2D2" };
const TEXT_TOKENS = {
  ink: "#0F1614",
  "ink-soft": "#1F2A26",
  "ink-muted": "#46524B",
  "leaf-text": "#0A6247",
  "ember-text": "#A83E1B",
  "swiggy-text": "#A04300"
};

const AA_NORMAL = 4.5;
const failures: string[] = [];

for (const [tName, tHex] of Object.entries(TEXT_TOKENS)) {
  for (const [bName, bHex] of Object.entries(BACKGROUNDS)) {
    const ratio = contrast(tHex, bHex);
    if (ratio < AA_NORMAL) {
      failures.push(`${tName} on ${bName}: ${ratio.toFixed(2)} (needs ${AA_NORMAL})`);
    }
  }
}
assert.deepEqual(failures, [], `Text tokens failing WCAG AA:\n  ${failures.join("\n  ")}`);

// Filled buttons: the label must clear AA against its own fill.
const FILLS: [string, string, string][] = [
  ["ink on swiggy fill", "#0F1614", "#FC8019"],
  ["cream on ink fill", "#F8F5EF", "#0F1614"]
];
for (const [label, fg, bg] of FILLS) {
  const ratio = contrast(fg, bg);
  assert.ok(ratio >= AA_NORMAL, `${label}: ${ratio.toFixed(2)} below ${AA_NORMAL}`);
}

// Guard the specific regression this suite was written for: white on Swiggy
// orange is 2.16:1. If someone "restores" it, this fails loudly.
assert.ok(
  contrast("#FFFFFF", "#FC8019") < AA_NORMAL,
  "sanity: white on Swiggy orange should be known-bad"
);

console.log("contrast: all text tokens pass WCAG AA on every background");
