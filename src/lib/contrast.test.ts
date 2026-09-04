/**
 * Contrast gate for the design tokens, in BOTH themes.
 *
 * GlycoCart's users manage PCOS, prediabetes and type 2 diabetes — populations
 * with elevated rates of diabetic retinopathy and reduced contrast sensitivity.
 * Low-contrast text is an accessibility failure aimed squarely at the people
 * the product exists for, so the palette is asserted, not eyeballed.
 *
 * The values are PARSED OUT OF globals.css rather than copied here. The old
 * version carried a "must mirror tailwind.config.ts" comment, which is a
 * promise, not a check — a hand-copied palette drifts silently.
 *
 * Run: npm run test:contrast
 */
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const rgb = (triple: string): [number, number, number] => {
  const [r, g, b] = triple.trim().split(/\s+/).map(Number);
  return [r, g, b];
};
const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = (t: [number, number, number]) => {
  const [r, g, b] = t.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Every `--token: r g b;` declaration inside one `:root { ... }` block. */
function tokensFrom(block: string): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(\d+\s+\d+\s+\d+)\s*;/g)) {
    out[m[1]] = rgb(m[2]);
  }
  return out;
}

const roots = [...css.matchAll(/:root\s*\{([\s\S]*?)\n\s*\}/g)].map((m) => m[1]);
assert.equal(roots.length, 2, `expected a light and a dark :root block, found ${roots.length}`);

const light = tokensFrom(roots[0]);
const dark = { ...light, ...tokensFrom(roots[1]) }; // dark overrides only what it redefines

const SURFACES = ["cream", "cream-warm", "cream-deep"];
const TEXT = ["ink", "ink-soft", "ink-muted", "leaf-text", "ember-text", "swiggy-text"];
const AA_NORMAL = 4.5;

for (const [themeName, theme] of [["light", light], ["dark", dark]] as const) {
  const failures: string[] = [];
  for (const t of TEXT) {
    for (const s of SURFACES) {
      assert.ok(theme[t], `${themeName}: missing token --${t}`);
      assert.ok(theme[s], `${themeName}: missing token --${s}`);
      const ratio = contrast(theme[t], theme[s]);
      if (ratio < AA_NORMAL) failures.push(`${t} on ${s}: ${ratio.toFixed(2)}`);
    }
  }
  assert.deepEqual(failures, [], `${themeName} theme fails WCAG AA:\n  ${failures.join("\n  ")}`);

  // Filled controls: the label must clear AA against its own fill. `on-accent`
  // is deliberately theme-independent — following `ink` would put a near-white
  // label on Swiggy orange at 2.16:1.
  for (const fill of ["swiggy", "ember"]) {
    const ratio = contrast(theme["on-accent"], theme[fill]);
    assert.ok(
      ratio >= AA_NORMAL,
      `${themeName}: on-accent on ${fill} fill is ${ratio.toFixed(2)}, below ${AA_NORMAL}`
    );
  }
  // The primary button is `bg-ink text-cream`, which flips with the theme.
  const primary = contrast(theme["cream"], theme["ink"]);
  assert.ok(primary >= AA_NORMAL, `${themeName}: primary button label is ${primary.toFixed(2)}`);
}

// Guard the specific regression this suite was written for: white on Swiggy
// orange is 2.16:1. If someone "restores" it, this fails loudly.
assert.ok(
  contrast([255, 255, 255], light["swiggy"]) < AA_NORMAL,
  "sanity: white on Swiggy orange should be known-bad"
);

console.log("contrast: light and dark tokens both pass WCAG AA on every surface");
