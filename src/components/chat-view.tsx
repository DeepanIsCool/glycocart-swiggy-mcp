"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import {
  Send, Sparkles, Settings2, ChevronDown, Search, Info, Eye, EyeOff,
  CheckCircle2, XCircle, Loader2, ArrowDown
} from "lucide-react";
import { DishCard, type ScoredItem } from "./dish-card";
import {
  RestaurantCard,
  DineoutCard,
  type ScoredRestaurant,
  type DineoutRestaurantView
} from "./restaurant-card";
import { ToolCallCard } from "./tool-call-card";
import { ChatSidebar, ChatHistoryButton } from "./chat-sidebar";
import { cn } from "@/lib/utils";
import Image from "next/image";

/** Display-safe slice of the user's profile — the metabolic model stays server-side. */
export interface ProfileView {
  displayName: string;
  conditionLabel: string;
  dailyCalTarget: number;
  blocklist: string[];
  fastingBaseline: number;
  defaultAddressId?: string;
}

/** Mirrors the server-side default in /api/chat so the UI names what's actually running. */
const DEFAULT_MODEL_LABEL = "nemotron-3-ultra-550b (default)";

const SUGGESTED_PROMPTS = [
  "What's the best lunch I can order near me right now?",
  "Find biryani near me and tell me which won't spike me",
  "Show me open restaurants near my home address",
  "Something high-protein under 500 kcal"
];

export function ChatView({ profile }: { profile: ProfileView }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [provider, setProvider] = useState<"openrouter" | "nvidia">("nvidia");
  const [customModel, setCustomModel] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
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
      body: { provider, customModel, customApiKey, sessionId }
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
    if (!customApiKey.trim()) return true;
    if (provider === "nvidia" && !customApiKey.startsWith("nvapi-")) {
      setShowSettings(true);
      return false;
    }
    if (provider === "openrouter" && !customApiKey.startsWith("sk-or-v1-")) {
      setShowSettings(true);
      return false;
    }
    return true;
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

  useEffect(() => {
    async function fetchModels() {
      if (!showSettings) return;
      if (customApiKey) {
        if (provider === "nvidia" && !customApiKey.startsWith("nvapi-")) return setKeyStatus("invalid");
        if (provider === "openrouter" && !customApiKey.startsWith("sk-or-v1-")) return setKeyStatus("invalid");
      } else {
        setKeyStatus("idle");
      }

      setIsLoadingModels(true);
      if (customApiKey) setKeyStatus("checking");
      try {
        const res = await fetch("/api/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, customApiKey })
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.models)) {
            setAvailableModels(data.models);
            if (customApiKey) setKeyStatus("valid");
          }
        } else if (customApiKey) {
          setKeyStatus("invalid");
        }
      } catch {
        if (customApiKey) setKeyStatus("invalid");
      } finally {
        setIsLoadingModels(false);
      }
    }
    const t = setTimeout(fetchModels, 500);
    return () => clearTimeout(t);
  }, [provider, customApiKey, showSettings]);

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
      {/* Profile context bar */}
      <div className="px-5 md:px-10 py-4 bg-leaf-pale/40 border-b border-ink/8 relative z-20 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-xs gap-4 min-w-0">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <ChatHistoryButton onClick={() => setSidebarOpen(true)} />
            <ContextChip label="condition" value={profile.conditionLabel} />
            <ContextChip label="target" value={`${profile.dailyCalTarget} kcal/day`} />
            {profile.blocklist.length > 0 && (
              <ContextChip label="avoid" value={profile.blocklist.slice(0, 2).join(", ")} />
            )}
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-ink-muted hover:text-ink transition-colors p-2 -m-2 shrink-0"
            aria-label="AI settings"
          >
            <Settings2 size={16} />
          </button>
        </div>

        {showSettings && (
          <div className="max-w-3xl mx-auto mt-4 p-4 bg-cream-warm border border-ink/10 rounded-xl animate-fade-up">
            <h4 className="mono text-ink text-[0.8125rem] mb-3">AI Settings (optional)</h4>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as "openrouter" | "nvidia")}
                className="bg-cream border border-ink/10 rounded-md px-3 py-1.5 text-xs outline-none focus:border-leaf w-full sm:w-auto"
              >
                <option value="nvidia">NVIDIA</option>
                <option value="openrouter">OpenRouter</option>
              </select>
              <ModelCombobox
                models={availableModels}
                value={customModel}
                onChange={setCustomModel}
                isLoading={isLoadingModels}
              />
              <div className="relative flex-1">
                <input
                  type={showApiKey ? "text" : "password"}
                  placeholder="Your own API key (optional)"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className={cn(
                    "bg-cream border rounded-md pl-3 pr-16 py-1.5 text-xs w-full outline-none transition-colors",
                    keyStatus === "valid" ? "border-leaf bg-leaf-pale/20" :
                    keyStatus === "invalid" ? "border-red-400 bg-red-50" :
                    "border-ink/10 focus:border-leaf"
                  )}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {keyStatus === "checking" && <Loader2 size={14} className="text-leaf animate-spin" />}
                  {keyStatus === "valid" && <CheckCircle2 size={14} className="text-leaf" />}
                  {keyStatus === "invalid" && <XCircle size={14} className="text-red-500" />}
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="text-ink-muted hover:text-ink transition-colors"
                    aria-label={showApiKey ? "Hide API key" : "Show API key"}
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-5 md:px-10 pt-6 pb-4 min-h-0 relative"
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
        <div className="px-5 md:px-10 pb-4 pt-2 border-t border-ink/5">
          <div className="max-w-3xl mx-auto">
            <p className="mono text-ink-muted text-xs mb-2">try one of these</p>
            <div className="flex gap-2 flex-wrap">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSuggestedPrompt(p)}
                  className="text-xs px-3 py-2 rounded-full bg-cream-warm border border-ink/10 hover:bg-cream-deep transition-colors text-left"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleChatSubmit} className="px-5 md:px-10 pb-6 pt-2 border-t border-ink/8 bg-cream shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask GlycoCart to find something to eat…"
            disabled={isLoading}
            className="flex-1 bg-cream-warm rounded-full px-5 py-3 text-sm border border-ink/10 focus:outline-none focus:border-leaf transition-colors"
          />
          <button type="submit" disabled={isLoading || !input.trim()} className="btn-primary disabled:cursor-not-allowed">
            <Send size={14} />
          </button>
        </div>
        <p className="mono text-xs text-ink-muted text-center mt-3">
          live swiggy mcp · glucose figures are estimates · not medical advice
        </p>
      </form>
      </div>
    </div>
  );
}

function ContextChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex gap-1.5 items-baseline">
      <span className="mono text-ink-muted text-[0.8125rem]">{label}</span>
      <span className="text-ink-soft">{value}</span>
    </span>
  );
}

function EmptyState({ profile }: { profile: ProfileView }) {
  return (
    <div className="text-center py-6 sm:py-12 animate-fade-up">
      <Image
        src="/glycocart_logo.png"
        alt="GlycoCart"
        width={64}
        height={64}
        className="mx-auto mb-4 rounded-full shadow-md"
      />
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-leaf-pale text-leaf-text text-xs mb-4">
        <Sparkles size={12} />
        <span className="mono">live swiggy mcp · your account</span>
      </div>
      <h2 className="display text-2xl sm:text-3xl mb-2">Hi {profile.displayName}.</h2>
      <p className="text-ink-muted max-w-md mx-auto leading-relaxed text-sm sm:text-base">
        Your profile is loaded — baseline {profile.fastingBaseline} mg/dL. Ask me to find
        food near you and I&apos;ll estimate what each dish does to your glucose.
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

function ModelCombobox({
  models, value, onChange, isLoading
}: {
  models: any[]; value: string; onChange: (val: string) => void; isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = models.filter(
    (m) =>
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.id.toLowerCase().includes(query.toLowerCase())
  );
  const selectedModel = models.find((m) => m.id === value);

  return (
    <div className="relative flex-1">
      <div
        className="flex items-center gap-2 bg-cream border border-ink/10 rounded-md px-3 py-1.5 text-xs cursor-pointer hover:border-leaf transition-colors h-full"
        onClick={() => setOpen(!open)}
      >
        <div className="flex-1 truncate">
          {isLoading
            ? "Loading models…"
            : selectedModel
              ? selectedModel.name
              : value || DEFAULT_MODEL_LABEL}
        </div>
        <ChevronDown size={14} className="text-ink-muted shrink-0" />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 w-[min(20rem,calc(100vw-2.5rem))] z-50 bg-cream border border-ink/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden flex flex-col max-h-[300px] animate-fade-up">
            <div className="p-2 border-b border-ink/5 bg-cream-warm sticky top-0 z-10">
              <div className="flex items-center gap-2 bg-cream border border-ink/10 rounded px-2 py-1.5 focus-within:border-leaf transition-colors">
                <Search size={12} className="text-ink-muted" />
                <input
                  autoFocus
                  className="bg-transparent border-none outline-none text-xs flex-1"
                  placeholder="Search models…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-1">
              {filtered.map((m) => {
                const isFree = parseFloat(m.pricing?.prompt) === 0 && parseFloat(m.pricing?.completion) === 0;
                const ctxK = m.context_length ? `${Math.round(m.context_length / 1000)}K` : "";
                return (
                  <div
                    key={m.id}
                    onClick={() => { onChange(m.id); setOpen(false); setQuery(""); }}
                    className={cn(
                      "flex flex-col gap-1 p-2.5 rounded-lg cursor-pointer transition-colors mb-0.5",
                      value === m.id ? "bg-leaf-pale/50" : "hover:bg-cream-warm"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[0.8125rem] truncate flex-1">{m.name}</span>
                      {isFree ? (
                        <span className="text-xs bg-leaf/10 text-leaf px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Free</span>
                      ) : (
                        <span className="text-xs bg-ink/5 text-ink-soft px-1.5 py-0.5 rounded uppercase tracking-wider font-bold flex items-center gap-1">
                          Paid <Info size={9} className="opacity-60" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-ink-muted font-mono leading-none">
                      <span className="truncate">{m.id}</span>
                      {ctxK && <span className="shrink-0 bg-ink/5 px-1 py-0.5 rounded">{ctxK}</span>}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="p-4 text-center text-xs text-ink-muted">No models found</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
