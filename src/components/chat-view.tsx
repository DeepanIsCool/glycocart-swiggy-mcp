"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2, ArrowDown, SquarePen, PanelLeft } from "lucide-react";
import { DishCard, type ScoredItem } from "./dish-card";
import {
  RestaurantCard,
  DineoutCard,
  type ScoredRestaurant,
  type DineoutRestaurantView
} from "./restaurant-card";
import { ToolCallCard } from "./tool-call-card";
import { ChatSidebar } from "./chat-sidebar";
import { loadAiSettings, CHANGED, keyLooksValid, type AiSettings, DEFAULTS } from "@/lib/ai-settings";
import { cn } from "@/lib/utils";
import Link from "next/link";

/** Display-safe slice of the user's profile — the metabolic model stays server-side. */
export interface ProfileView {
  displayName: string;
  conditionLabel: string;
  dailyCalTarget: number;
  blocklist: string[];
  fastingBaseline: number;
  defaultAddressId?: string;
}

/** Short enough to read as chips; the full question is what gets sent. */
const SUGGESTED_PROMPTS: { label: string; prompt: string }[] = [
  { label: "Best lunch near me", prompt: "What's the best lunch I can order near me right now?" },
  { label: "Biryani that won't spike me", prompt: "Find biryani near me and tell me which biryani won't spike me" },
  { label: "High protein, under 500 kcal", prompt: "Something high-protein under 500 kcal" },
  { label: "Open restaurants nearby", prompt: "Show me open restaurants near my home address" },
  { label: "A table for tonight", prompt: "Find me somewhere good to eat out tonight" }
];

export function ChatView({ profile }: { profile: ProfileView }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Model choice lives in Settings now; the chat just reads it.
  const [ai, setAi] = useState<AiSettings>(DEFAULTS);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionsKey, setSessionsKey] = useState(0);

  /**
   * Add straight to the real Swiggy cart. The single-restaurant conflict is
   * detected server-side and surfaced here rather than silently wiping the cart.
   */
  async function addToCart(item: ScoredItem) {
    if (!profile.defaultAddressId) {
      setCartNotice("Pick a delivery address in Settings first.");
      return;
    }
    setCartNotice(null);
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: item.restaurant_id,
          restaurantName: item.restaurant_name,
          addressId: profile.defaultAddressId,
          menuItemId: item.id,
          quantity: 1
        })
      });
      const data = await res.json();
      if (data?.conflict === "different_restaurant") {
        setCartNotice(
          `Your cart already has items from ${data.current_restaurant}. Swiggy carts hold one restaurant at a time — empty it from the Cart tab to start a new one.`
        );
        return;
      }
      if (!res.ok || data?.success === false) {
        setCartNotice(data?.error?.message ?? data?.message ?? "Couldn't add that to your cart.");
        return;
      }
      setCartNotice(`Added ${item.name} to your Swiggy cart.`);
    } catch {
      setCartNotice("Couldn't reach Swiggy. Try again.");
    }
  }

  const { messages, input, handleInputChange, isLoading, append, setInput, error, setMessages } =
    useChat({
      api: "/api/chat",
      body: {
        provider: ai.provider,
        customModel: ai.model,
        customApiKey: ai.apiKey,
        sessionId
      }
    });

  /** Create the session lazily on first send, so empty chats never persist. */
  async function ensureSession(firstMessage: string): Promise<string | null> {
    if (sessionId) return sessionId;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstMessage })
      });
      if (!res.ok) return null;
      const { session } = await res.json();
      setSessionId(session.id);
      setSessionsKey((k) => k + 1);
      return session.id;
    } catch {
      return null;
    }
  }

  async function loadSession(id: string) {
    setSidebarOpen(false);
    setSessionId(id);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      const { messages: stored } = await res.json();
      setMessages(
        (stored ?? []).map((m: any, i: number) => ({
          id: `${id}-${i}`,
          role: m.role,
          content: m.content ?? "",
          // Without this a reopened chat came back as bare text — every dish,
          // restaurant and dineout card was dropped, which is most of the
          // answer. The tool results were in the database the whole time.
          toolInvocations: restoreInvocations(m.toolInvocations)
        }))
      );
    } catch {
      setMessages([]);
    }
  }

  function newChat() {
    setSidebarOpen(false);
    setSessionId(null);
    setMessages([]);
    setCartNotice(null);
  }

  const validateApiKey = () => {
    if (keyLooksValid(ai.provider, ai.apiKey)) return true;
    setCartNotice(`That API key doesn't look like a ${ai.provider} key. Fix it in Settings.`);
    return false;
  };

  const handleChatSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateApiKey()) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    // Pass the id explicitly: setSessionId() won't have re-rendered before
    // append() reads the hook body, so a fresh session would post sessionId=null
    // and the transcript would never be saved.
    const id = await ensureSession(text);
    append({ role: "user", content: text }, { body: { sessionId: id } });
  };

  const handleSuggestedPrompt = async (p: string) => {
    if (!validateApiKey()) return;
    const id = await ensureSession(p);
    append({ role: "user", content: p }, { body: { sessionId: id } });
  };

  // Settings can change in another tab, or on the Settings screen itself.
  useEffect(() => {
    const sync = () => setAi(loadAiSettings());
    sync();
    window.addEventListener(CHANGED, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
  };

  const empty = messages.length === 0;

  return (
    <div className="flex flex-1 min-h-0">
      <ChatSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeId={sessionId}
        onSelect={loadSession}
        onNew={newChat}
        refreshKey={sessionsKey}
      />

      {/* min-w-0: a flex child defaults to min-width:auto, so one wide tool-call
          line made the entire chat column wider than the phone screen. */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
      {/*
        * App bar. One navigation control per side, a wordmark in the middle,
        * nothing else. It replaced a four-row header that carried the profile
        * summary, an avoid-list and a gear that expanded a provider/model/API-key
        * panel over the conversation — all of which belong on Profile and in
        * Settings, not on top of the task the screen exists for.
        */}
      <header className="app-bar">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="app-bar-action md:invisible"
          aria-label="Chat history"
        >
          <PanelLeft size={19} />
        </button>

        <span className="display text-lg select-none">GlycoCart</span>

        <button
          type="button"
          onClick={newChat}
          className="app-bar-action"
          aria-label="New chat"
        >
          <SquarePen size={19} />
        </button>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden px-5 md:px-10 pt-6 pb-4 min-h-0 relative",
          // An empty conversation centres, rather than hugging the app bar with
          // a screen of dead space beneath it.
          empty && "flex flex-col justify-center"
        )}
      >
        <div className="max-w-3xl mx-auto space-y-5 min-w-0">
          {empty && <EmptyState profile={profile} />}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-3", m.role === "user" && "items-end")}>
              {m.role === "user" && (
                <div className="bg-ink text-cream px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%] text-sm">
                  {m.content}
                </div>
              )}

              {m.role === "assistant" && (
                <>
                  {m.toolInvocations?.map((t: any) => (
                    <ToolCallCard
                      key={t.toolCallId}
                      toolName={t.toolName}
                      args={t.args}
                      result={t.state === "result" ? t.result : undefined}
                      state={t.state}
                    />
                  ))}

                  {extractRestaurants(m).map((r, i) => (
                    <RestaurantCard key={`${r.id ?? r.name}-${i}`} r={r} />
                  ))}

                  {extractDineout(m).map((r, i) => (
                    <DineoutCard key={`dineout-${r.id ?? r.name}-${i}`} r={r} />
                  ))}

                  {extractScoredItems(m).map((item, i) => (
                    <DishCard
                      key={`${item.id ?? item.name}-${i}`}
                      item={item}
                      rank={i + 1}
                      onAddToCart={addToCart}
                    />
                  ))}

                  {hasEmptyResult(m) && extractScoredItems(m).length === 0 && (
                    <div className="card-solid p-5 text-sm text-ink-soft leading-relaxed">
                      <p className="font-medium mb-1">No dishes matched that search.</p>
                      <p className="text-ink-muted">
                        Try a broader term (&ldquo;lunch&rdquo; rather than a specific dish), or
                        check that your delivery address in Settings is the one you meant.
                      </p>
                    </div>
                  )}

                  {m.content && (
                    <div className="bg-cream-warm/60 px-4 py-3 rounded-2xl rounded-bl-md max-w-[92%] text-sm leading-relaxed text-ink whitespace-pre-wrap break-words">
                      {plainText(m.content)}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && <ThinkingDots />}

          {cartNotice && (
            <p className="text-sm text-leaf-text bg-leaf-pale/50 rounded-xl px-4 py-2.5">
              {cartNotice}
            </p>
          )}

          {error && (
            <p className="text-sm text-ember-text">
              {error.message || "Something went wrong. Try again."}
            </p>
          )}
        </div>
      </div>

      {showScrollBtn && (
        <div className="relative z-10">
          <button
            onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
            className="absolute -top-14 left-1/2 -translate-x-1/2 bg-ink text-cream size-9 rounded-full flex items-center justify-center shadow-lg hover:bg-ink/80 transition-all animate-fade-up"
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={16} />
          </button>
        </div>
      )}

      {empty && (
        <div className="pt-2 pb-3">
          <div
            className="max-w-3xl mx-auto flex gap-2 overflow-x-auto px-5 md:px-10 pb-1
            [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {SUGGESTED_PROMPTS.map(({ label, prompt }) => (
              <button
                key={label}
                onClick={() => handleSuggestedPrompt(prompt)}
                className="shrink-0 text-sm px-4 py-2.5 rounded-full bg-cream-warm border border-ink/10
                hover:bg-cream-deep active:scale-[0.98] transition-all whitespace-nowrap"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleChatSubmit} className="px-5 md:px-10 pb-6 pt-2 border-t border-ink/8 bg-cream shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask for something to eat…"
            disabled={isLoading}
            className="flex-1 bg-cream-warm rounded-full px-5 py-3 text-sm border border-ink/10 focus:outline-none focus:border-leaf transition-colors"
          />
          <button type="submit" disabled={isLoading || !input.trim()} className="btn-primary disabled:cursor-not-allowed">
            <Send size={14} />
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

/**
 * The one place the profile summary and the disclaimer belong: seen once, when
 * the screen is otherwise empty, instead of framing every message forever.
 */
function EmptyState({ profile }: { profile: ProfileView }) {
  return (
    <div className="text-center py-6 sm:py-10 animate-fade-up">
      <h2 className="display text-2xl sm:text-3xl mb-2">Hi {profile.displayName}.</h2>
      <p className="text-ink-muted max-w-sm mx-auto leading-relaxed text-sm">
        Ask me to find food near you and I&apos;ll estimate what each dish does to your
        glucose.
      </p>

      <Link
        href="/profile"
        className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 mt-5 rounded-full
        border border-ink/10 bg-cream-warm px-4 py-2 text-xs text-ink-soft hover:bg-cream-deep transition-colors"
      >
        <span>{profile.conditionLabel}</span>
        <span className="text-ink-muted">·</span>
        <span>baseline {profile.fastingBaseline} mg/dL</span>
        <span className="text-ink-muted">·</span>
        <span>{profile.dailyCalTarget} kcal</span>
        {profile.blocklist.length > 0 && (
          <>
            <span className="text-ink-muted">·</span>
            <span className="text-ink-muted">avoiding {profile.blocklist.slice(0, 2).join(", ")}</span>
          </>
        )}
      </Link>

      <p className="text-xs text-ink-muted max-w-xs mx-auto mt-5 leading-relaxed">
        <Sparkles size={11} className="inline mr-1 -mt-0.5" />
        Live from your Swiggy account. Glucose figures are estimates, not medical advice.
      </p>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-1.5 items-center px-2">
      {[0, 200, 400].map((d) => (
        <span
          key={d}
          className="size-1.5 rounded-full bg-ink-muted animate-pulse-dot"
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
      <span className="mono text-xs text-ink-muted ml-1">reasoning…</span>
    </div>
  );
}

/**
 * Harvest dishes from tool results for card rendering.
 *
 * Unscoreable dishes are INCLUDED (sorted last). Previously they were filtered
 * out, which silently hid real dishes Swiggy returned and made DishCard's
 * "Not scored" state dead code — the opposite of being honest about what we
 * can and can't estimate.
 */
function extractScoredItems(msg: any): ScoredItem[] {
  const out: ScoredItem[] = [];
  for (const t of msg.toolInvocations ?? []) {
    if (t.state !== "result") continue;

    if (t.toolName === "search_menu" && Array.isArray(t.result?.items)) {
      out.push(...t.result.items);
    }
    // Restaurant menus carry the same scored shape and were never rendered.
    if (t.toolName === "get_restaurant_menu" && Array.isArray(t.result?.categories)) {
      for (const cat of t.result.categories) {
        if (Array.isArray(cat?.items)) out.push(...cat.items);
      }
    }
  }
  const scored = out.filter((i) => i?.glycemic);
  const unscored = out.filter((i) => i && !i.glycemic);
  return [...scored, ...unscored].slice(0, 5);
}

/**
 * Rebuild `toolInvocations` from what was persisted. The chat route stores the
 * SDK's `{ toolCalls, toolResults }`; the UI needs one merged record per call
 * with its result attached.
 */
function restoreInvocations(stored: any): any[] | undefined {
  const calls = stored?.toolCalls;
  if (!Array.isArray(calls) || calls.length === 0) return undefined;
  const results = new Map(
    (stored.toolResults ?? []).map((r: any) => [r?.toolCallId, r?.result])
  );
  return calls.map((c: any) => ({
    toolCallId: c?.toolCallId,
    toolName: c?.toolName,
    args: c?.args,
    state: results.has(c?.toolCallId) ? "result" : "call",
    result: results.get(c?.toolCallId)
  }));
}

/**
 * The reply is rendered as plain text, so stray markdown shows up as literal
 * asterisks and hashes. The system prompt asks the model not to emit any; it
 * still does occasionally, and a prompt is not an enforcement mechanism.
 */
function plainText(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S(?:.*?\S)?)\*(?=\s|$)/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "· ");
}

/**
 * Restaurants from search_restaurants. These used to arrive as structured data
 * and get rendered as a wall of numbered prose, because nothing in the UI knew
 * what to do with them.
 */
function extractRestaurants(msg: any): ScoredRestaurant[] {
  const out: ScoredRestaurant[] = [];
  for (const t of msg.toolInvocations ?? []) {
    if (t.state !== "result" || t.toolName !== "search_restaurants") continue;
    if (Array.isArray(t.result?.restaurants)) out.push(...t.result.restaurants);
  }
  // Open places first — a shut restaurant is not a recommendation.
  const open = out.filter((r) => r.is_open !== false);
  const closed = out.filter((r) => r.is_open === false);
  return [...open, ...closed].slice(0, 6);
}

/** Dineout results carry their own ordering brief, so they get their own card. */
function extractDineout(msg: any): DineoutRestaurantView[] {
  const out: DineoutRestaurantView[] = [];
  for (const t of msg.toolInvocations ?? []) {
    if (t.state !== "result" || t.toolName !== "search_dineout") continue;
    if (Array.isArray(t.result?.restaurants)) out.push(...t.result.restaurants);
  }
  return out.slice(0, 6);
}

/** True when a tool ran but the underlying Swiggy call reported failure. */
function toolFailed(t: any) {
  return t.state === "result" && t.result?.success === false;
}

/** A search ran and legitimately returned nothing — worth saying so explicitly. */
function hasEmptyResult(msg: any): boolean {
  for (const t of msg.toolInvocations ?? []) {
    if (t.state !== "result" || toolFailed(t)) continue;
    if (t.toolName === "search_menu" && Array.isArray(t.result?.items) && t.result.items.length === 0) {
      return true;
    }
  }
  return false;
}
