"use client";

import { Area, AreaChart, ResponsiveContainer, ReferenceLine, XAxis, YAxis, Tooltip } from "recharts";

export function GlucoseChart({
  curve,
  peak,
  height = 120
}: {
  curve: { t: number; mgDl: number }[];
  peak: number;
  height?: number;
}) {
  const verdict = peak < 130 ? "excellent" : peak < 145 ? "good" : peak < 165 ? "moderate" : "poor";
  const color =
    verdict === "excellent" ? "#0E7E5C" :
    verdict === "good" ? "#0E7E5C" :
    verdict === "moderate" ? "#D9A53A" : "#D9613A";

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <AreaChart data={curve} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="t"
            tick={{ fontSize: 10, fill: "#5C6B65" }}
            tickFormatter={(v) => `${v}m`}
            axisLine={false} tickLine={false}
            ticks={[0, 60, 120, 180]}
          />
          <YAxis
            domain={[80, 200]}
            tick={{ fontSize: 10, fill: "#5C6B65" }}
            axisLine={false} tickLine={false}
            width={28}
          />
          <ReferenceLine y={140} stroke="#5C6B65" strokeDasharray="2 4" strokeOpacity={0.4} />
          <Tooltip
            contentStyle={{
              background: "#0F1614", border: "none", borderRadius: 8,
              fontSize: 11, color: "#F8F5EF", padding: "6px 10px"
            }}
            formatter={(v: number) => [`${v} mg/dL`, "glucose"]}
            labelFormatter={(v) => `+${v} min`}
          />
          <Area
            type="monotone" dataKey="mgDl"
            stroke={color} strokeWidth={2}
            fill={`url(#grad-${color})`}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
