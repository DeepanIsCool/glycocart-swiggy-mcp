"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, ReferenceLine, XAxis, YAxis, Tooltip } from "recharts";

/**
 * Recharts takes colours as SVG presentation attributes, where `var(--token)`
 * is not resolved — so the palette is read off the document once and re-read
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
  // Amber has no palette token; it only ever appears here, for "moderate".
  const AMBER = "#D9A53A";
  const color = !c ? "transparent" : peak < 145 ? c.leaf : peak < 165 ? AMBER : c.ember;
  const gradientId = `glucose-grad-${peak}`;

  // Render nothing until the palette is known, rather than one frame of the
  // wrong theme's colours.
  if (!c) return <div style={{ height }} className="w-full" aria-hidden />;

  return (
    <div style={{ height }} className="w-full">
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
            tick={{ fontSize: 12, fill: c["ink-muted"] }}
            tickFormatter={(v) => `${v}m`}
            axisLine={false} tickLine={false}
            ticks={[0, 60, 120, 180]}
          />
          <YAxis
            domain={[80, 200]}
            tick={{ fontSize: 12, fill: c["ink-muted"] }}
            axisLine={false} tickLine={false}
            width={34}
          />
          {/* ADA's <140 mg/dL post-prandial target. */}
          <ReferenceLine y={140} stroke={c["ink-muted"]} strokeDasharray="2 4" strokeOpacity={0.4} />
          <Tooltip
            contentStyle={{
              background: c.ink, border: "none", borderRadius: 8,
              fontSize: 12, color: c.cream, padding: "6px 10px"
            }}
            formatter={(v: number) => [`${v} mg/dL`, "glucose"]}
            labelFormatter={(v) => `+${v} min`}
          />
          <Area
            type="monotone" dataKey="mgDl"
            stroke={color} strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
