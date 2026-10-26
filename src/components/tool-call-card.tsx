"use client";

import { useId, useState } from "react";
import { ChevronDown, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * What each step is doing, in words. The row used to lead with the raw
 * identifier ("swiggy.search_menu q=biryani"), which made every reply open with
 * a block of developer output above the answer. The identifier and arguments
 * are still one tap away in the expanded panel.
 */
const TOOL_LABELS: Record<string, { running: string; done: string }> = {
  get_addresses: { running: "Reading your saved addresses", done: "Read your saved addresses" },
  search_restaurants: { running: "Searching restaurants near you", done: "Searched restaurants near you" },
  get_restaurant_menu: { running: "Reading the menu and scoring dishes", done: "Read the menu and scored dishes" },
  search_menu: { running: "Searching dishes and scoring them", done: "Searched dishes and scored them" },
  get_food_cart: { running: "Checking your Swiggy cart", done: "Checked your Swiggy cart" },
  update_food_cart: { running: "Updating your Swiggy cart", done: "Updated your Swiggy cart" },
  flush_food_cart: { running: "Emptying your Swiggy cart", done: "Emptied your Swiggy cart" },
  fetch_food_coupons: { running: "Looking up coupons", done: "Looked up coupons" },
  apply_food_coupon: { running: "Applying a coupon", done: "Applied a coupon" },
  get_food_orders: { running: "Reading your past orders", done: "Read your past orders" },
  track_food_order: { running: "Tracking your order", done: "Tracked your order" },
  get_food_order_details: { running: "Reading order details", done: "Read order details" },
  search_dineout: { running: "Searching places to eat out", done: "Searched places to eat out" },
  get_dineout_locations: { running: "Finding Dineout locations", done: "Found Dineout locations" },
  get_dineout_restaurant: { running: "Reading restaurant details", done: "Read restaurant details" },
  get_dineout_slots: { running: "Checking table availability", done: "Checked table availability" },
  search_products: { running: "Searching Instamart", done: "Searched Instamart" },
  your_go_to_items: { running: "Reading your usual Instamart items", done: "Read your usual Instamart items" },
  get_instamart_cart: { running: "Checking your Instamart cart", done: "Checked your Instamart cart" },
  update_instamart_cart: { running: "Updating your Instamart cart", done: "Updated your Instamart cart" },
  list_instamart_coupons: { running: "Looking up Instamart coupons", done: "Looked up Instamart coupons" }
};

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-leaf";

export function ToolCallCard({
  toolName,
  args,
  result,
  state,
  stopped = false
}: {
  toolName: string;
  args?: any;
  result?: any;
  state: "call" | "result" | "partial-call";
  /** The turn ended (Stop, or an error) before this call returned. */
  stopped?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const isDone = state === "result";
  const labels = TOOL_LABELS[toolName];
  const label = labels ? (isDone ? labels.done : labels.running) : toolName;
  // A tool can "complete" and still have failed. Showing a green tick for a
  // failed Swiggy call made errors invisible unless you expanded the raw JSON.
  const failed = isDone && (result as any)?.success === false;
  const failureMessage =
    failed ? ((result as any)?.error?.message ?? "Swiggy couldn't complete this request") : null;

  return (
    <div className="card overflow-hidden border-ink/8">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "w-full min-h-11 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl hover:bg-ink/[0.02] transition-colors text-left",
          FOCUS
        )}
      >
        {/* min-w-0 everywhere a truncate lives: without it a long label set the
            page's minimum width, and the whole chat scrolled sideways on a
            375px screen. */}
        {!isDone && stopped ? (
          <AlertCircle size={14} className="text-ink-muted shrink-0" aria-hidden />
        ) : !isDone ? (
          <Loader2 size={14} className="text-ink-muted animate-spin shrink-0" aria-hidden />
        ) : failed ? (
          <AlertCircle size={14} className="text-ember-text shrink-0" aria-hidden />
        ) : (
          <CheckCircle2 size={14} className="text-leaf-text shrink-0" aria-hidden />
        )}
        <span className={cn("flex-1 min-w-0 truncate text-[0.8125rem]", isDone ? "text-ink-soft" : "text-ink")}>
          {label}
          {!isDone && (stopped ? ". Stopped" : "…")}
          {failed && <span className="sr-only"> (failed)</span>}
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={cn(
            "text-ink-muted shrink-0 transition-transform motion-reduce:transition-none",
            open && "rotate-180"
          )}
        />
      </button>

      {failureMessage && (
        <p className="px-4 pb-3 -mt-0.5 text-[0.8125rem] text-ember-text">{failureMessage}</p>
      )}

      {open && (
        <div id={panelId} className="px-4 pb-3 pt-2 border-t border-ink/8 bg-ink/[0.015]">
          <div className="mono text-xs text-ink-muted mb-2 break-all normal-case">{toolName}</div>
          {args && (
            <div className="mb-2">
              <div className="mono text-xs text-ink-muted mb-1">args</div>
              <pre className="font-mono text-[0.8125rem] text-ink-soft whitespace-pre-wrap break-all">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {isDone && result && (
            <div>
              <div className="mono text-xs text-ink-muted mb-1">result</div>
              <pre className="font-mono text-[0.8125rem] text-ink-soft whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
