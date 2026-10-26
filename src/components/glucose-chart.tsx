"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, ReferenceLine, XAxis, YAxis, Tooltip } from "recharts";

/**
 * Recharts takes colours as SVG presentation attributes, where `var(--token)`
 * is not resolved, so the palette is read off the document once and re-read
 * when the system theme flips. Hardcoded light-theme hexes left the axis labels
 * at roughly 1.3:1 on the dark card.
 */
const TOKENS = ["ink", "ink-muted", "cream", "leaf", "ember"] as const;
type Token = (typeof TOKENS)[number];

function useThemeColors(): Record<Token, string> | null {
  const [colors, setColors] = useState<Record<Token, string> | null>(null);

  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      const out = {} as Record<Token, string>;
      for (const t of TOKENS) out[t] = `rgb(${style.getPropertyValue(`--${t}`).trim()})`;
      setColors(out);
    };
    read();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  return colors;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return reduced;
}

/** ADA's <140 mg/dL post-prandial target, drawn as the dashed line. */
const TARGET = 140;

/**
 * One sentence a screen reader can use in place of the chart. The SVG on its
 * own exposes nothing but a pile of tick labels.
 */
function describeCurve(curve: { t: number; mgDl: number }[], peak: number): string {
  if (curve.length === 0) return "No estimated glucose curve available.";
  const start = curve[0];
  const end = curve[curve.length - 1];
  const top = curve.reduce((a, b) => (b.mgDl > a.mgDl ? b : a), start);
  const vsTarget = peak >= TARGET ? `above the ${TARGET} target` : `under the ${TARGET} target`;
  return (
    `Estimated glucose curve, not a measurement. Starts at ${start.mgDl} mg/dL, ` +
    `peaks at about ${peak} mg/dL around ${top.t} minutes, ${vsTarget}, ` +
    `and is at ${end.mgDl} mg/dL by ${end.t} minutes.`
  );
}

export function GlucoseChart({
  curve,
  peak,
  height = 120
}: {
  curve: { t: number; mgDl: number }[];
  peak: number;
  height?: number;
}) {
  const c = useThemeColors();
  const reducedMotion = usePrefersReducedMotion();
  // Amber has no palette token; it only ever appears here, for "moderate".
  const AMBER = "#D9A53A";
  const color = !c ? "transparent" : peak < 145 ? c.leaf : peak < 165 ? AMBER : c.ember;
  const gradientId = `glucose-grad-${peak}`;
  const summary = describeCurve(curve, peak);

  // Render nothing visual until the palette is known, rather than one frame of
  // the wrong theme's colours. The summary is available either way.
  if (!c) {
    return (
      <div style={{ height }} className="w-full" role="img" aria-label={summary} />
    );
  }

  return (
    <figure className="w-full m-0">
      <div style={{ height }} className="w-full" role="img" aria-label={summary}>
        {/* aria-hidden: the role="img" label above stands in for the SVG. */}
        <div aria-hidden className="h-full w-full">
          <ResponsiveContainer>
            <AreaChart data={curve} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                type="number"
                domain={[0, 180]}
                tick={{ fontSize: 12, fill: c["ink-muted"] }}
                tickFormatter={(v: number) => `${v}m`}
                axisLine={false}
                tickLine={false}
                ticks={[0, 60, 120, 180]}
              />
              {/* The domain used to be a fixed 80 to 200, which clipped any
                  estimate above 200 off the top of the card. It now widens to
                  fit the curve, in steps of 20. */}
              <YAxis
                domain={[
                  (dataMin: number) => Math.min(80, Math.floor(dataMin / 20) * 20),
                  (dataMax: number) => Math.max(200, Math.ceil(dataMax / 20) * 20)
                ]}
                tick={{ fontSize: 12, fill: c["ink-muted"] }}
                axisLine={false}
                tickLine={false}
                width={34}
              />
              <ReferenceLine y={TARGET} stroke={c["ink-muted"]} strokeDasharray="2 4" strokeOpacity={0.7} />
              <Tooltip
                contentStyle={{
                  background: c.ink,
                  border: "none",
                  borderRadius: 8,
                  fontSize: 12,
                  color: c.cream,
                  padding: "6px 10px"
                }}
                itemStyle={{ color: c.cream }}
                labelStyle={{ color: c.cream }}
                formatter={(v: number) => [`${v} mg/dL`, "est. glucose"]}
                labelFormatter={(v) => `+${v} min`}
              />
              <Area
                type="monotone"
                dataKey="mgDl"
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                isAnimationActive={!reducedMotion}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <figcaption className="text-xs text-ink-muted mt-1" aria-hidden>
        Estimated mg/dL over 3 hours. Dashed line: {TARGET} mg/dL target.
      </figcaption>
    </figure>
  );
}
