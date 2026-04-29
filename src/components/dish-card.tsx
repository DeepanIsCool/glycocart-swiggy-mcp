"use client";

import { CheckCircle2, AlertTriangle, Flame } from "lucide-react";
import { GlucoseChart } from "./glucose-chart";
import { predictGlucoseResponse } from "@/lib/glycemic";
import { getDish } from "@/lib/catalog";
import type { Persona } from "@/lib/personas";
import { formatINR, cn } from "@/lib/utils";

interface DishCardProps {
  dishId: string;
  persona: Persona;
  matchScore?: number;
  why?: string;
  rank?: number;
}

export function DishCard({ dishId, persona, matchScore, why, rank }: DishCardProps) {
  const dish = getDish(dishId);
  const pred = predictGlucoseResponse(dish, persona);
  const score = matchScore ?? Math.round(pred.matchScore * 0.7 + 30);

  const verdictMeta = {
    excellent: { color: "text-leaf", bg: "bg-leaf-pale", label: "Excellent fit", Icon: CheckCircle2 },
    good: { color: "text-leaf", bg: "bg-leaf-pale", label: "Good fit", Icon: CheckCircle2 },
    moderate: { color: "text-ember", bg: "bg-ember-soft/30", label: "Moderate", Icon: AlertTriangle },
    poor: { color: "text-ember", bg: "bg-ember-soft/40", label: "Avoid", Icon: AlertTriangle }
  }[pred.verdict];

  return (
    <div className="card p-5 animate-fade-up">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {rank !== undefined && (
            <span className="mono text-ink-muted text-[0.65rem] block mb-1">#{rank}</span>
          )}
          <h4 className="display text-xl leading-tight mb-1">{dish.name}</h4>
          <p className="text-ink-muted text-sm">{dish.cuisine} · {formatINR(dish.price)}</p>
        </div>
        <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", verdictMeta.bg, verdictMeta.color)}>
          <verdictMeta.Icon size={12} />
          {verdictMeta.label}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4 text-center">
        <Stat label="kcal" value={dish.calories} />
        <Stat label="carbs" value={`${dish.carbs}g`} />
        <Stat label="protein" value={`${dish.protein}g`} />
        <Stat label="fiber" value={`${dish.fiber}g`} />
      </div>

      <div className="bg-ink/[0.025] rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="mono text-ink-muted text-[0.65rem]">predicted glucose · 3hr</span>
          <span className="mono text-ink text-[0.7rem] font-medium">peak {pred.peakMgDl} mg/dL</span>
        </div>
        <GlucoseChart curve={pred.curve} peak={pred.peakMgDl} height={100} />
      </div>

      {why && (
        <div className="flex gap-2 items-start text-xs text-ink-soft leading-relaxed">
          <Flame size={12} className="text-leaf mt-0.5 flex-shrink-0" />
          <span>{why}</span>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-ink/8 flex items-center justify-between">
        <span className="mono text-ink-muted text-[0.65rem]">match score</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-ink/8 overflow-hidden">
            <div
              className="h-full bg-leaf transition-all"
              style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
            />
          </div>
          <span className="font-mono text-sm font-medium">{score}/100</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cream py-2 rounded-lg">
      <div className="text-sm font-medium">{value}</div>
      <div className="mono text-ink-muted text-[0.6rem]">{label}</div>
    </div>
  );
}
