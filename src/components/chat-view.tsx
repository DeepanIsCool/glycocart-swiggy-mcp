"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, ShoppingBag, CheckCircle2, Activity, Settings2, ChevronDown, Search, Info, Eye, EyeOff, XCircle, Loader2, ArrowDown } from "lucide-react";
import type { Persona } from "@/lib/personas";
import { DishCard } from "./dish-card";
import { ToolCallCard } from "./tool-call-card";
import { GlucoseChart } from "./glucose-chart";
import { predictGlucoseResponse } from "@/lib/glycemic";
import { getDish } from "@/lib/catalog";
import { formatINR, cn } from "@/lib/utils";
import Image from "next/image";

const PROMPT_BANK: Record<string, string[]> = {
  pcos: [
    "I want lunch under 600 cal, North Indian, deliver in 30 min",
    "Build me a low-GI weekly grocery list",
    "Pick the safest option from Paradise Biryani for me",
    "I'm craving something rich — what won't wreck my insulin?"
  ],
  cgm: [
    "Order me lunch — keep predicted peak under 140 mg/dL",
    "What's the best dinner option on Swiggy that fits my profile?",
    "I want chicken tikka — find the safest restaurant",
    "Compare butter chicken vs grilled chicken for my body"
  ]
};

export function ChatView({ persona }: { persona: Persona }) {
  const prompts = PROMPT_BANK[persona.id] ?? PROMPT_BANK.pcos;
  const [orderConfirmation, setOrderConfirmation] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [provider, setProvider] = useState<"openrouter" | "nvidia">("openrouter");
  const [customModel, setCustomModel] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const validateApiKey = () => {
    if (!customApiKey.trim()) {
      alert("Please enter your API Key in the AI Settings (BYOK) to test the product.");
      setShowSettings(true);
      return false;
    }
    if (provider === "nvidia" && !customApiKey.startsWith("nvapi-")) {
      alert("You selected NVIDIA but provided an API key that doesn't start with nvapi-. Please check your key or change the provider.");
      setShowSettings(true);
      return false;
    }
    if (provider === "openrouter" && !customApiKey.startsWith("sk-or-v1-")) {
      alert("You selected OpenRouter but provided an API key that doesn't start with sk-or-v1-. Please check your key or change the provider.");
      setShowSettings(true);
      return false;
    }
    return true;
  };

  const handleChatSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateApiKey()) return;
    const text = input.trim();
    if (!text) return;
    setInput("");
    append({ role: "user", content: text });
  };

  const handleSuggestedPrompt = (p: string) => {
    if (!validateApiKey()) return;
    append({ role: "user", content: p });
  };

  useEffect(() => {
    async function fetchModels() {
      if (!showSettings) return;

      if (!customApiKey) {
        setKeyStatus("idle");
      } else {
        if (provider === "nvidia" && !customApiKey.startsWith("nvapi-")) {
          setKeyStatus("invalid");
          return;
        }
        if (provider === "openrouter" && !customApiKey.startsWith("sk-or-v1-")) {
          setKeyStatus("invalid");
          return;
        }
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
          if (data.models && Array.isArray(data.models)) {
            setAvailableModels(data.models);
            if (customApiKey) setKeyStatus("valid");
          }
        } else {
          if (customApiKey) setKeyStatus("invalid");
        }
      } catch (err) {
        console.error(err);
        if (customApiKey) setKeyStatus("invalid");
      } finally {
        setIsLoadingModels(false);
      }
    }
    
    // Add a small debounce if typing customApiKey
    const t = setTimeout(fetchModels, 500);
    return () => clearTimeout(t);
  }, [provider, customApiKey, showSettings]);

  const { messages, input, handleInputChange, handleSubmit, isLoading, append, setInput } = useChat({
    api: "/api/chat",
    body: { personaId: persona.id, provider, customModel, customApiKey },
    onFinish: (msg) => {
      // Detect successful order in tool results to show celebration
      const orderTool = msg.toolInvocations?.find(
        (t: any) => t.toolName === "place_order" && t.state === "result"
      );
      if (orderTool && (orderTool as any).result?.ok) {
        setOrderConfirmation((orderTool as any).result);
      }
    }
  });
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distanceFromBottom > 100);
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  };

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Persona context bar */}
      <div className="px-5 md:px-10 py-4 bg-leaf-pale/40 border-b border-ink/8 relative z-20 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <ContextChip label="goal" value={persona.goals[0]} />
            <ContextChip label="target" value={`${persona.dailyCalTarget} kcal/day`} />
            <ContextChip label="avoid" value={persona.blocklist.slice(0, 2).join(", ")} />
          </div>
          <div className="flex items-center gap-4">
            {persona.id === "cgm" && (
              <div className="hidden md:flex items-center gap-1.5 text-leaf">
                <Activity size={12} className="animate-pulse-dot" />
                <span className="mono text-[0.65rem]">cgm live · 102 mg/dL</span>
              </div>
            )}
            <button onClick={() => setShowSettings(!showSettings)} className="text-ink-muted hover:text-ink transition-colors">
              <Settings2 size={16} />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="max-w-3xl mx-auto mt-4 p-4 bg-cream-warm border border-ink/10 rounded-xl animate-fade-up">
            <h4 className="mono text-ink text-[0.7rem] mb-3">AI Settings (BYOK)</h4>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select 
                value={provider} 
                onChange={(e) => setProvider(e.target.value as "openrouter" | "nvidia")}
                className="bg-cream border border-ink/10 rounded-md px-3 py-1.5 text-xs outline-none focus:border-leaf"
              >
                <option value="openrouter">OpenRouter</option>
                <option value="nvidia">NVIDIA</option>
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
                  placeholder="Custom API Key (Required)"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className={cn(
                    "bg-cream border rounded-md pl-3 pr-16 py-1.5 text-xs w-full outline-none transition-colors",
                    keyStatus === "valid" ? "border-leaf bg-leaf-pale/20 focus:border-leaf" : 
                    keyStatus === "invalid" ? "border-red-400 bg-red-50 focus:border-red-500" : 
                    "border-ink/10 focus:border-leaf"
                  )}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {keyStatus === "checking" && <Loader2 size={14} className="text-leaf animate-spin" />}
                  {keyStatus === "valid" && <span title="Valid API Key"><CheckCircle2 size={14} className="text-leaf" /></span>}
                  {keyStatus === "invalid" && <span title="Invalid API Key"><XCircle size={14} className="text-red-500" /></span>}
                  
                  <button 
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)} 
                    className="text-ink-muted hover:text-ink transition-colors"
                    title={showApiKey ? "Hide API Key" : "Show API Key"}
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-5 md:px-10 py-8 min-h-0 relative">
        <div className="max-w-3xl mx-auto space-y-5">
          {empty && <EmptyState persona={persona} />}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex flex-col gap-3", m.role === "user" && "items-end")}>
              {m.role === "user" && (
                <div className="bg-ink text-cream px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%] text-sm">
                  {m.content}
                </div>
              )}

              {m.role === "assistant" && (
                <>
                  {/* Render tool invocations interleaved */}
                  {m.toolInvocations?.map((t: any) => (
                    <ToolCallCard
                      key={t.toolCallId}
                      toolName={t.toolName}
                      args={t.args}
                      result={t.state === "result" ? t.result : undefined}
                      state={t.state}
                    />
                  ))}

                  {/* Render rich dish cards if rank tool returned recommendations */}
                  {extractDishRecs(m).map((rec, i) => (
                    <DishCard
                      key={rec.dish_id + i}
                      dishId={rec.dish_id}
                      persona={persona}
                      matchScore={rec.match_score}
                      why={rec.why}
                      rank={i + 1}
                    />
                  ))}

                  {/* The natural-language reply */}
                  {m.content && (
                    <div className="bg-cream-warm/60 px-4 py-3 rounded-2xl rounded-bl-md max-w-[92%] text-sm leading-relaxed text-ink whitespace-pre-wrap">
                      {m.content}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && <ThinkingDots />}
        </div>
      </div>

      {/* Scroll to bottom floating button */}
      {showScrollBtn && (
        <div className="relative z-10">
          <button
            onClick={scrollToBottom}
            className="absolute -top-14 left-1/2 -translate-x-1/2 bg-ink text-cream size-9 rounded-full flex items-center justify-center shadow-lg hover:bg-ink/80 transition-all animate-fade-up cursor-pointer"
            title="Scroll to bottom"
          >
            <ArrowDown size={16} />
          </button>
        </div>
      )}

      {/* Suggested prompts */}
      {empty && (
        <div className="px-5 md:px-10 pb-4">
          <div className="max-w-3xl mx-auto">
            <p className="mono text-ink-muted text-[0.65rem] mb-2">try one of these</p>
            <div className="flex gap-2 flex-wrap">
              {prompts.map((p) => (
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

      {/* Input */}
      <form onSubmit={handleChatSubmit} className="px-5 md:px-10 pb-6 pt-2 border-t border-ink/8 bg-cream shrink-0">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask GlycoCart to find or order something…"
            disabled={isLoading}
            className="flex-1 bg-cream-warm rounded-full px-5 py-3 text-sm border border-ink/10 focus:outline-none focus:border-leaf transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="btn-primary disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="mono text-[0.6rem] text-ink-muted text-center mt-3">
          demo · mock swiggy mcp · cod orders only · not medical advice
        </p>
      </form>

      {/* Order success modal */}
      {orderConfirmation && (
        <OrderSuccess
          order={orderConfirmation}
          persona={persona}
          onClose={() => setOrderConfirmation(null)}
        />
      )}
    </div>
  );
}

function ContextChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex gap-1.5 items-baseline">
      <span className="mono text-ink-muted text-[0.6rem]">{label}</span>
      <span className="text-ink-soft">{value}</span>
    </span>
  );
}

function EmptyState({ persona }: { persona: Persona }) {
  return (
    <div className="text-center py-12 animate-fade-up">
      <Image
        src="/glycocart_logo.png"
        alt="GlycoCart"
        width={80}
        height={80}
        className="mx-auto mb-6 rounded-full shadow-md"
      />
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-leaf-pale text-leaf text-xs mb-6">
        <Sparkles size={12} />
        <span className="mono">connected to swiggy mcp · mock</span>
      </div>
      <h2 className="display text-3xl mb-3">Hi {persona.name}.</h2>
      <p className="text-ink-muted max-w-md mx-auto leading-relaxed">
        I've loaded your metabolic profile. Ask me to find food, rank options,
        or place an order — I'll keep your glucose curve in mind.
      </p>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-1.5 items-center px-2">
      <span className="size-1.5 rounded-full bg-ink-muted animate-pulse-dot" style={{ animationDelay: "0ms" }} />
      <span className="size-1.5 rounded-full bg-ink-muted animate-pulse-dot" style={{ animationDelay: "200ms" }} />
      <span className="size-1.5 rounded-full bg-ink-muted animate-pulse-dot" style={{ animationDelay: "400ms" }} />
      <span className="mono text-[0.65rem] text-ink-muted ml-1">reasoning…</span>
    </div>
  );
}

function extractDishRecs(msg: any): { dish_id: string; match_score?: number; why?: string }[] {
  const recs: any[] = [];
  for (const t of msg.toolInvocations ?? []) {
    if (t.state !== "result") continue;
    const r = t.result;
    if (t.toolName === "rank_dishes_for_user" && Array.isArray(r?.recommendations)) {
      recs.push(...r.recommendations.slice(0, 3));
    }
  }
  return recs;
}

function OrderSuccess({
  order, persona, onClose
}: { order: any; persona: Persona; onClose: () => void }) {
  const dish = order.dish_ids ? getDish(order.dish_ids[0]) : null;

  // Build a combined forecast curve from the predicted_glucose result
  const forecast = predictGlucoseResponse(
    dish ?? getDish("d_dal_tadka"),
    persona
  );

  return (
    <div className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm flex items-center justify-center px-4 animate-fade-up">
      <div className="card max-w-md w-full p-7">
        <div className="flex items-center gap-2 text-leaf mb-4">
          <CheckCircle2 size={18} />
          <span className="mono text-sm">order confirmed</span>
        </div>
        <h3 className="display text-3xl mb-1">It's on the way.</h3>
        <p className="text-ink-muted text-sm mb-6">
          Order {order.order_id} · ETA {order.eta_min} min · COD {formatINR(order.total)}
        </p>

        <div className="bg-cream rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="mono text-ink-muted text-[0.65rem]">your forecasted glucose</span>
            <span className="mono text-[0.65rem] font-medium">peak {order.predicted_glucose.peak_mg_dl} mg/dL</span>
          </div>
          <GlucoseChart curve={forecast.curve} peak={forecast.peakMgDl} height={120} />
        </div>

        <div className="space-y-2 text-sm">
          <ConfirmRow icon={ShoppingBag} text={`Paid: ₹${order.total} on delivery`} />
          <ConfirmRow icon={Activity} text={`Auto-logged to ${order.health_app_log.synced_to}`} />
          <ConfirmRow icon={CheckCircle2} text={`Predicted: ${order.predicted_glucose.verdict} response`} />
        </div>

        <button onClick={onClose} className="btn-primary w-full justify-center mt-6">
          Continue
        </button>
      </div>
    </div>
  );
}

function ConfirmRow({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-2 text-ink-soft">
      <Icon size={14} className="text-leaf" />
      <span>{text}</span>
    </div>
  );
}

function ModelCombobox({ 
  models, value, onChange, isLoading 
}: { 
  models: any[]; value: string; onChange: (val: string) => void; isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  
  const filtered = models.filter(m => 
    m.name.toLowerCase().includes(query.toLowerCase()) || 
    m.id.toLowerCase().includes(query.toLowerCase())
  );

  const selectedModel = models.find(m => m.id === value);

  return (
    <div className="relative flex-1">
      <div 
        className="flex items-center gap-2 bg-cream border border-ink/10 rounded-md px-3 py-1.5 text-xs cursor-pointer hover:border-leaf transition-colors h-full"
        onClick={() => setOpen(!open)}
      >
        <div className="flex-1 truncate">
          {isLoading ? "Loading models..." : (selectedModel ? selectedModel.name : (value || "Select a model"))}
        </div>
        <ChevronDown size={14} className="text-ink-muted shrink-0" />
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 left-0 w-64 md:w-80 z-50 bg-cream border border-ink/10 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] overflow-hidden flex flex-col max-h-[300px] animate-fade-up" style={{ animationDuration: '0.15s' }}>
            <div className="p-2 border-b border-ink/5 bg-cream-warm sticky top-0 z-10">
              <div className="flex items-center gap-2 bg-cream border border-ink/10 rounded px-2 py-1.5 focus-within:border-leaf transition-colors">
                <Search size={12} className="text-ink-muted" />
                <input 
                  autoFocus
                  className="bg-transparent border-none outline-none text-xs flex-1 text-ink placeholder:text-ink-muted" 
                  placeholder="Search models..." 
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
              {filtered.map(m => {
                const isFree = parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0;
                const ctxK = m.context_length ? Math.round(m.context_length / 1000) + 'K' : '';
                
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
                      <span className="font-medium text-[0.7rem] text-ink truncate flex-1">{m.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isFree ? (
                          <span className="text-[0.55rem] bg-leaf/10 text-leaf px-1.5 py-0.5 rounded uppercase tracking-wider font-bold">Free</span>
                        ) : (
                          <span className="text-[0.55rem] bg-ink/5 text-ink-soft px-1.5 py-0.5 rounded uppercase tracking-wider font-bold flex items-center gap-1" title={`Prompt: $${m.pricing.prompt}/1M, Comp: $${m.pricing.completion}/1M`}>
                            Paid <Info size={9} className="opacity-60" />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[0.6rem] text-ink-muted font-mono leading-none">
                      <span className="truncate" title={m.id}>{m.id}</span>
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
