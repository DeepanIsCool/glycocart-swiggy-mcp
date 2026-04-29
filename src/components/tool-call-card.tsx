"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const TOOL_LABELS: Record<string, string> = {
  search_restaurants: "swiggy.search_restaurants",
  get_restaurant_menu: "swiggy.get_restaurant_menu",
  rank_dishes_for_user: "glycocart.rank_dishes",
  place_order: "swiggy.place_order"
};

export function ToolCallCard({
  toolName,
  args,
  result,
  state
}: {
  toolName: string;
  args?: any;
  result?: any;
  state: "call" | "result";
}) {
  const [open, setOpen] = useState(false);
  const label = TOOL_LABELS[toolName] ?? toolName;
  const isDone = state === "result";

  return (
    <div className="card overflow-hidden border-ink/8">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-ink/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-1">
          {isDone ? (
            <CheckCircle2 size={14} className="text-leaf flex-shrink-0" />
          ) : (
            <Loader2 size={14} className="text-ink-muted animate-spin flex-shrink-0" />
          )}
          <Wrench size={12} className="text-ink-muted" />
          <span className="mono text-[0.7rem] text-ink">{label}</span>
          <span className="mono text-[0.65rem] text-ink-muted truncate">
            {args && Object.entries(args).slice(0, 2).map(([k, v]) =>
              `${k}=${truncate(String(v), 24)}`).join(" · ")}
          </span>
        </div>
        {open ? <ChevronDown size={14} className="text-ink-muted" /> : <ChevronRight size={14} className="text-ink-muted" />}
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-ink/8 bg-ink/[0.015]">
          {args && (
            <div className="mb-2">
              <div className="mono text-[0.6rem] text-ink-muted mb-1">args</div>
              <pre className="font-mono text-[0.7rem] text-ink-soft whitespace-pre-wrap break-all">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {isDone && result && (
            <div>
              <div className="mono text-[0.6rem] text-ink-muted mb-1">result</div>
              <pre className="font-mono text-[0.7rem] text-ink-soft whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
