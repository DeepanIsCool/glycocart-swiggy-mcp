"use client";

import { preferenceRank } from "@/lib/preferences";
import { useChat } from "ai/react";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUp, ArrowDown, Square, SquarePen, PanelLeft, RotateCw, X } from "lucide-react";
import { DishCard, DishCardSkeleton, type ScoredItem } from "./dish-card";
import {
  RestaurantCard,
  DineoutCard,
  type ScoredRestaurant,
  type DineoutRestaurantView
} from "./restaurant-card";
import { ToolCallCard } from "./tool-call-card";
import { ChatSidebar } from "./chat-sidebar";
import {
  loadAiSettings,
  CHANGED,
  keyLooksValid,
  type AiSettings,
  type Provider,
  DEFAULTS
} from "@/lib/ai-settings";
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

/** With the article, so the copy never reads "a openrouter key". */
const KEY_NAME: Record<Provider, string> = {
  nvidia: "an NVIDIA",
  openrouter: "an OpenRouter"
};

/** Keyboard focus is otherwise invisible: the base styles reset outlines. */
/** Within this many px of the end, new content keeps the view pinned to it. */
const STICK_PX = 80;

/** Tallest the composer grows before it scrolls internally (~6 lines). */
const COMPOSER_MAX_PX = 160;

interface Notice {
  tone: "success" | "error";
  text: string;
  action?: { href: string; label: string };
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ChatView({ profile }: { profile: ProfileView }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  /**
   * Whether new content should keep the view at the bottom. Off as soon as the
   * reader scrolls up. Before this, every streamed chunk smooth-scrolled to
   * the end, so reading an earlier reply while a new one arrived was impossible.
   */
  const stickRef = useRef(true);
  /** Blocks a second send while the session is still being created. */
  const submittingRef = useRef(false);
  /** Ignores a slow session load that a newer tap has superseded. */
  const loadSeq = useRef(0);
  const addingRef = useRef(false);
  const [errorHidden, setErrorHidden] = useState(false);

  // Model choice lives in Settings now; the chat just reads it.
  const [ai, setAi] = useState<AiSettings>(DEFAULTS);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionsKey, setSessionsKey] = useState(0);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionLoadFailed, setSessionLoadFailed] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  /**
   * Add straight to the real Swiggy cart. The single-restaurant conflict is
   * detected server-side and surfaced here rather than silently wiping the cart.
   *
   * The result used to be a line appended to the end of the conversation, in
   * green even when it was an error, and out of sight when you added a dish
   * from further up. It is now a snackbar over the composer.
   */
  async function addToCart(item: ScoredItem) {
    // Each add reads, merges and rewrites the whole Swiggy cart, so two
    // overlapping adds can drop the first dish. One at a time.
    if (addingRef.current) return;
    if (!profile.defaultAddressId) {
      setNotice({
        tone: "error",
        text: "Pick a delivery address in Settings first.",
        action: { href: "/settings", label: "Settings" }
      });
      return;
    }
    setNotice(null);
    addingRef.current = true;
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: item.restaurant_id,
          restaurantName: item.restaurant_name,
          addressId: profile.defaultAddressId,
          menuItemId: item.id,
          quantity: 1,
          mode: "add"
        })
      });
      const data = await res.json().catch(() => ({}));
      if (data?.conflict === "different_restaurant") {
        setNotice({
          tone: "error",
          text: `Your cart already has items from ${data.current_restaurant}. Swiggy carts hold one restaurant at a time. Empty it from the Cart tab to start a new one.`,
          action: { href: "/cart", label: "Open cart" }
        });
        return;
      }
      if (!res.ok || data?.success === false) {
        setNotice({
          tone: "error",
          // The route's own errors are plain strings; Swiggy's are { message }.
          text:
            (typeof data?.error === "string" ? data.error : data?.error?.message) ??
            data?.message ??
            "Couldn't add that to your cart."
        });
        return;
      }
      setNotice({
        tone: "success",
        text: `Added ${item.name} to your Swiggy cart.`,
        action: { href: "/cart", label: "View cart" }
      });
    } catch {
      setNotice({ tone: "error", text: "Couldn't reach Swiggy. Try again." });
    } finally {
      addingRef.current = false;
    }
  }

  const {
    messages,
    input,
    handleInputChange,
    isLoading,
    append,
    setInput,
    error,
    setMessages,
    stop,
    reload
  } = useChat({
    api: "/api/chat",
    // The history list is ordered by last activity; refresh it after a reply.
    onFinish: () => setSessionsKey((k) => k + 1),
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
    const seq = loadSeq.current;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstMessage })
      });
      if (!res.ok) return null;
      const { session } = await res.json();
      if (seq !== loadSeq.current) return null;
      setSessionId(session.id);
      setSessionsKey((k) => k + 1);
      return session.id;
    } catch {
      return null;
    }
  }

  async function loadSession(id: string) {
    if (isLoading) stop();
    setErrorHidden(true);
    setSidebarOpen(false);
    setSessionId(id);
    setNotice(null);
    setSessionLoadFailed(false);
    setLoadingSession(true);
    // Clear first so the skeleton shows, rather than the previous chat sitting
    // there looking current until the fetch lands.
    setMessages([]);
    const seq = ++loadSeq.current;
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) throw new Error(String(res.status));
      const { messages: stored } = await res.json();
      if (seq !== loadSeq.current) return;
      stickRef.current = true;
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
      if (seq !== loadSeq.current) return;
      setMessages([]);
      setSessionLoadFailed(true);
    } finally {
      if (seq === loadSeq.current) setLoadingSession(false);
    }
  }

  function newChat() {
    // A reply still streaming would otherwise land in the fresh chat.
    if (isLoading) stop();
    setErrorHidden(true);
    loadSeq.current++;
    setSidebarOpen(false);
    setSessionId(null);
    setMessages([]);
    setNotice(null);
    setLoadingSession(false);
    setSessionLoadFailed(false);
    stickRef.current = true;
  }

  const validateApiKey = () => {
    if (keyLooksValid(ai.provider, ai.apiKey)) return true;
    const settings = { href: "/settings", label: "Settings" };
    if (ai.provider === "openrouter" && !ai.apiKey.trim()) {
      setNotice({
        tone: "error",
        text: "OpenRouter needs your own API key. Add one in Settings, or switch to NVIDIA, which is free.",
        action: settings
      });
    } else {
      setNotice({
        tone: "error",
        text: `That API key doesn't look like ${KEY_NAME[ai.provider] ?? "a valid"} key. Fix it in Settings.`,
        action: settings
      });
    }
    return false;
  };

  /** One path for the composer and the suggestion chips. */
  async function send(raw: string, fromComposer: boolean) {
    const text = raw.trim();
    if (!text || isLoading || submittingRef.current) return;
    if (!validateApiKey()) return;
    submittingRef.current = true;
    setErrorHidden(false);
    if (notice?.tone === "error") setNotice(null);
    if (fromComposer) setInput("");
    stickRef.current = true;
    try {
      // Pass the id explicitly: setSessionId() won't have re-rendered before
      // append() reads the hook body, so a fresh session would post sessionId=null
      // and the transcript would never be saved.
      const seq = loadSeq.current;
      const id = await ensureSession(text);
      // New chat or a saved chat opened while the session was being created:
      // this message belongs to neither, so drop it rather than misfile it.
      if (seq !== loadSeq.current) return;
      append({ role: "user", content: text }, { body: { sessionId: id } });
    } finally {
      submittingRef.current = false;
    }
  }

  const handleChatSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void send(input, true);
  };

  /** Enter sends, Shift+Enter is a new line. Never mid-IME-composition. */
  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Safari confirms an IME composition with an Enter whose isComposing is
    // false but keyCode is 229.
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    void send(input, true);
  };

  const retry = () => {
    if (!validateApiKey()) return;
    stickRef.current = true;
    setErrorHidden(false);
    // `retry` tells the server this question is already saved.
    reload({ body: { sessionId, retry: true } });
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

  const scrollToBottom = (smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
  };

  // Follow the conversation only while the reader is at the end of it. A
  // ResizeObserver catches every kind of growth: streamed text, cards
  // arriving, dish photos finishing loading after the scroll already ran.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stickRef.current) scrollToBottom(false);
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (stickRef.current) scrollToBottom(false);
  }, [messages, isLoading]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickRef.current = distance < STICK_PX;
    setShowScrollBtn(distance > STICK_PX * 2);
  };

  // The composer grows with its content, up to about six lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_PX)}px`;
  }, [input]);

  // A confirmation clears itself; an error waits to be read and dismissed.
  useEffect(() => {
    if (notice?.tone !== "success") return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  /**
   * Screen-reader announcements. The streamed bubble is deliberately not a
   * live region: it would read out every chunk as it arrived. Instead this
   * says once that a reply has started, and reads the finished reply.
   */
  const wasLoading = useRef(false);
  useEffect(() => {
    if (isLoading && !wasLoading.current) {
      setAnnouncement("GlycoCart is working on a reply.");
    } else if (!isLoading && wasLoading.current) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant") {
        const dishes = extractScoredItems(last).length;
        const parts: string[] = [];
        if (last.content) parts.push(plainText(last.content));
        if (dishes > 0) parts.push(`${dishes} ${dishes === 1 ? "dish" : "dishes"} shown.`);
        setAnnouncement(parts.join(" ") || "Reply finished.");
      }
    }
    wasLoading.current = isLoading;
  }, [isLoading, messages]);

  const empty = messages.length === 0 && !loadingSession && !sessionLoadFailed;
  const lastMessage = messages[messages.length - 1];
  const waitingForFirstToken = isLoading && lastMessage?.role === "user";
  // useChat only clears `error` on the next request, so the card followed the
  // user into a new or reopened chat, where Try again regenerated the wrong one.
  const errorText = error && !errorHidden ? describeChatError(error) : null;
  const errorAction = errorText ? errorRecovery(errorText) : null;

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
          className={cn("app-bar-action md:invisible", "focus-ring")}
          aria-label="Chat history"
          aria-expanded={sidebarOpen}
        >
          <PanelLeft size={19} aria-hidden />
        </button>

        <h1 className="display text-lg select-none">GlycoCart</h1>

        <button
          type="button"
          onClick={newChat}
          className={cn("app-bar-action", "focus-ring")}
          aria-label="New chat"
        >
          <SquarePen size={19} aria-hidden />
        </button>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden overscroll-contain px-4 md:px-10 pt-5 pb-4 min-h-0"
      >
        {/* my-auto, not justify-center, centres the empty state: a
            justify-center column clips its top when the content overflows. */}
        <div
          ref={contentRef}
          className={cn("w-full max-w-3xl mx-auto space-y-5 min-w-0", empty && "my-auto")}
        >
          {empty && <EmptyState profile={profile} />}

          {loadingSession && <ConversationSkeleton />}

          {sessionLoadFailed && sessionId && (
            <div className="card-solid p-5 text-sm leading-relaxed" role="alert">
              <p className="font-medium text-ink">Couldn&apos;t open that chat.</p>
              <p className="text-ink-muted mt-1">Check your connection and try again.</p>
              <button
                type="button"
                onClick={() => loadSession(sessionId)}
                className={cn("btn-ghost -ml-3 mt-2 min-h-11 text-ink", "focus-ring")}
              >
                <RotateCw size={14} aria-hidden /> Try again
              </button>
            </div>
          )}

          {messages.map((m, idx) => {
            const streaming = isLoading && idx === messages.length - 1 && m.role === "assistant";
            const dishes = m.role === "assistant" ? extractScoredItems(m) : [];
            return (
              <div
                key={m.id}
                className={cn("flex flex-col gap-3", m.role === "user" && "items-end")}
                aria-busy={streaming || undefined}
              >
                {m.role === "user" && (
                  <div className="bg-ink text-cream px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%] text-[0.9375rem] leading-relaxed whitespace-pre-wrap break-words">
                    <span className="sr-only">You: </span>
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
                        stopped={!isLoading}
                      />
                    ))}

                    {extractRestaurants(m).map((r, i) => (
                      <RestaurantCard key={`${r.id ?? r.name}-${i}`} r={r} />
                    ))}

                    {extractDineout(m).map((r, i) => (
                      <DineoutCard key={`dineout-${r.id ?? r.name}-${i}`} r={r} />
                    ))}

                    {dishes.map((item, i) => (
                      <DishCard
                        key={`${item.id ?? item.name}-${i}`}
                        item={item}
                        rank={i + 1}
                        onAddToCart={addToCart}
                      />
                    ))}

                    {/* The dish list's shape is known before it arrives, so the
                        wait shows that shape instead of only a spinner. Only
                        while streaming: a stopped or restored turn can hold a
                        call that never resolved. */}
                    {streaming && dishes.length === 0 && hasPendingMenuSearch(m) && (
                      <div className="space-y-3">
                        <DishCardSkeleton />
                        <DishCardSkeleton />
                        <DishCardSkeleton />
                      </div>
                    )}

                    {hasEmptyResult(m) && dishes.length === 0 && (
                      <div className="card-solid p-5 text-sm text-ink-soft leading-relaxed">
                        {dietExcluded(m) > 0 ? (
                          <>
                            {/* Every result was non-veg. "No dishes matched" was untrue. */}
                            <p className="font-medium mb-1">Every dish found was non-veg.</p>
                            <p className="text-ink-muted">
                              {dietExcluded(m)} {dietExcluded(m) === 1 ? "result was" : "results were"} left
                              out for your diet. Try a vegetarian dish name instead.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium mb-1">No dishes matched that search.</p>
                            <p className="text-ink-muted">
                              Try a broader term (&ldquo;lunch&rdquo; rather than a specific dish), or
                              check that your delivery address in Settings is the one you meant.
                            </p>
                          </>
                        )}
                      </div>
                    )}

                    {m.content && (
                      <div className="bg-cream-warm/60 px-4 py-3 rounded-2xl rounded-bl-md max-w-[92%] text-[0.9375rem] leading-relaxed text-ink whitespace-pre-wrap break-words">
                        {plainText(m.content)}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {waitingForFirstToken && <TypingIndicator />}

          {errorText && (
            <div className="card-solid p-4 text-sm leading-relaxed" role="alert">
              <p className="font-medium text-ember-text">That reply didn&apos;t come through.</p>
              <p className="text-ink-soft mt-1 break-words">{errorText}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {errorAction && (
                  <Link href={errorAction.href} className={cn("btn-primary min-h-11 py-2.5 text-sm", "focus-ring")}>
                    {errorAction.label}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={retry}
                  className={cn(
                    errorAction ? "btn-ghost min-h-11 text-ink" : "btn-primary min-h-11 py-2.5 text-sm",
                    "focus-ring"
                  )}
                >
                  <RotateCw size={14} aria-hidden /> Try again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating layer above the composer: jump-to-latest and the snackbar. */}
      <div className="relative z-10 shrink-0">
        <div className="absolute bottom-full inset-x-0 px-4 md:px-10 pb-3 flex flex-col items-center gap-2 pointer-events-none">
          {showScrollBtn && (
            <button
              type="button"
              onClick={() => {
                stickRef.current = true;
                scrollToBottom(true);
              }}
              className={cn(
                "pointer-events-auto bg-ink text-cream size-11 rounded-full flex items-center justify-center shadow-lg hover:bg-ink-soft transition-colors motion-safe:animate-fade-up",
                "focus-ring"
              )}
              aria-label="Scroll to latest message"
            >
              <ArrowDown size={18} aria-hidden />
            </button>
          )}

          {notice && (
            <div
              key={notice.text}
              role={notice.tone === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto w-full max-w-3xl card-solid flex items-center gap-2 pl-4 pr-1 py-1 text-sm motion-safe:animate-fade-up",
                notice.tone === "error" ? "text-ember-text" : "text-leaf-text"
              )}
            >
              <p className="flex-1 min-w-0 py-2 leading-snug break-words">{notice.text}</p>
              {notice.action && (
                <Link
                  href={notice.action.href}
                  className={cn(
                    "shrink-0 min-h-11 inline-flex items-center px-3 rounded-full font-medium text-ink hover:bg-cream-deep transition-colors",
                    "focus-ring"
                  )}
                >
                  {notice.action.label}
                </Link>
              )}
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Dismiss"
                className={cn(
                  "shrink-0 size-11 rounded-full inline-flex items-center justify-center text-ink-muted hover:text-ink hover:bg-cream-deep transition-colors",
                  "focus-ring"
                )}
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>

      {empty && (
        <div className="pt-2 pb-1 shrink-0">
          <div
            className="max-w-3xl mx-auto flex gap-2 overflow-x-auto px-4 md:px-10 py-1
            scrollbar-none"
          >
            {SUGGESTED_PROMPTS.map(({ label, prompt }) => (
              <button
                type="button"
                key={label}
                onClick={() => void send(prompt, false)}
                className={cn(
                  "shrink-0 min-h-11 text-sm px-4 rounded-full bg-cream-warm border border-ink/10 hover:bg-cream-deep active:scale-[0.98] transition-all motion-reduce:transition-none whitespace-nowrap",
                  "focus-ring"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/*
        * Composer. A textarea that grows with its content; Enter sends,
        * Shift+Enter adds a line. It stays editable while a reply streams:
        * disabling it dropped focus, which on a phone also closed the keyboard
        * after every send. While streaming, the send button becomes Stop.
        * 16px text: anything smaller makes iOS Safari zoom the page on focus.
        */}
      <form
        onSubmit={handleChatSubmit}
        className="px-3 md:px-10 pt-2 pb-3 border-t border-ink/10 bg-cream shrink-0"
      >
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <label htmlFor={inputId} className="sr-only">
            Message GlycoCart
          </label>
          <textarea
            id={inputId}
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleComposerKeyDown}
            placeholder="Ask for something to eat…"
            enterKeyHint="send"
            autoComplete="off"
            className={cn(
              "flex-1 min-w-0 resize-none bg-cream-warm rounded-[1.375rem] px-4 py-2.5 text-base leading-6 text-ink",
              "border border-ink/10 placeholder:text-ink-muted transition-colors overflow-y-auto",
              "focus:outline-none focus:border-leaf focus:ring-1 focus:ring-leaf"
            )}
            style={{ maxHeight: COMPOSER_MAX_PX }}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={() => stop()}
              aria-label="Stop reply"
              className={cn(
                "shrink-0 size-11 rounded-full bg-ink text-cream inline-flex items-center justify-center hover:bg-ink-soft active:scale-95 transition-all motion-reduce:transition-none",
                "focus-ring"
              )}
            >
              <Square size={14} fill="currentColor" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send"
              className={cn(
                "shrink-0 size-11 rounded-full bg-ink text-cream inline-flex items-center justify-center hover:bg-ink-soft active:scale-95 transition-all motion-reduce:transition-none",
                "disabled:bg-cream-deep disabled:text-ink-muted disabled:cursor-not-allowed disabled:active:scale-100",
                "focus-ring"
              )}
            >
              <ArrowUp size={19} strokeWidth={2.25} aria-hidden />
            </button>
          )}
        </div>
      </form>

      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
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
    <div className="text-center py-6 sm:py-10 motion-safe:animate-fade-up">
      <h2 className="display text-2xl sm:text-3xl mb-2">Hi {profile.displayName}.</h2>
      <p className="text-ink-muted max-w-sm mx-auto leading-relaxed text-sm">
        Ask me to find food near you and I&apos;ll estimate what each dish does to your
        glucose.
      </p>

      <Link
        href="/profile"
        aria-label={`Your profile: ${profile.conditionLabel}, fasting baseline ${profile.fastingBaseline} mg/dL, ${profile.dailyCalTarget} kcal a day. Edit profile.`}
        className={cn(
          "inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 mt-5 min-h-11 rounded-full border border-ink/10 bg-cream-warm px-4 py-2 text-xs text-ink-soft hover:bg-cream-deep transition-colors",
          "focus-ring"
        )}
      >
        <span>{profile.conditionLabel}</span>
        <span className="text-ink-muted" aria-hidden>·</span>
        <span>baseline {profile.fastingBaseline} mg/dL</span>
        <span className="text-ink-muted" aria-hidden>·</span>
        <span>{profile.dailyCalTarget} kcal</span>
        {profile.blocklist.length > 0 && (
          <>
            <span className="text-ink-muted" aria-hidden>·</span>
            <span className="text-ink-muted">avoiding {profile.blocklist.slice(0, 2).join(", ")}</span>
          </>
        )}
      </Link>

      <p className="text-xs text-ink-muted max-w-xs mx-auto mt-5 leading-relaxed">
        Live from your Swiggy account. Glucose figures are estimates, not medical advice.
      </p>
    </div>
  );
}

/**
 * The wait before the first token. A reply bubble with three dots, where the
 * reply will appear. It replaced a tiny ALL-CAPS "REASONING…" label.
 */
function TypingIndicator() {
  return (
    <div className="flex">
      <div className="bg-cream-warm/60 px-4 py-3.5 rounded-2xl rounded-bl-md flex gap-1.5 items-center">
        {[0, 200, 400].map((d) => (
          <span
            key={d}
            aria-hidden
            className="size-1.5 rounded-full bg-ink-muted motion-safe:animate-pulse-dot"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
        <span className="sr-only">GlycoCart is replying</span>
      </div>
    </div>
  );
}

/** A reopened chat, while its transcript loads: one question, one answer. */
function ConversationSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading chat">
      <div className="flex justify-end" aria-hidden>
        <div className="h-10 w-3/5 rounded-2xl rounded-br-md skeleton" />
      </div>
      <div className="space-y-3" aria-hidden>
        <DishCardSkeleton />
        <DishCardSkeleton />
        <div className="h-16 w-4/5 rounded-2xl rounded-bl-md skeleton" />
      </div>
    </div>
  );
}

/** True while a dish-producing tool call is still running for this message. */
function hasPendingMenuSearch(msg: any): boolean {
  for (const t of msg.toolInvocations ?? []) {
    if (t.state === "result") continue;
    if (t.toolName === "search_menu" || t.toolName === "get_restaurant_menu") return true;
  }
  return false;
}

/**
 * useChat surfaces a non-OK response as an Error whose message is the raw
 * response body, so a JSON `{ "error": "..." }` used to be shown verbatim,
 * braces and all. Pull out the sentence the server wrote.
 */
function describeChatError(err: Error): string {
  const raw = (err.message ?? "").trim();
  if (raw.startsWith("{")) {
    try {
      const j = JSON.parse(raw);
      if (typeof j?.error === "string") return j.error;
      if (typeof j?.error?.message === "string") return j.error.message;
      if (typeof j?.message === "string") return j.message;
    } catch {
      // Not JSON after all; show it as written.
    }
  }
  return raw || "Something went wrong. Try again.";
}

/** Where the person can actually fix the error, when it isn't a transient one. */
function errorRecovery(text: string): { href: string; label: string } | null {
  if (/sign in again|session expired/i.test(text)) return { href: "/", label: "Sign in" };
  if (/api key|settings|openrouter|nvidia/i.test(text)) return { href: "/settings", label: "Open Settings" };
  return null;
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
  // Menus arrive in Swiggy's order, not ranked, yet the cards are numbered
  // 1 to 5 as best fit first. Rank by this person's match score.
  // Their diet rules some dishes out entirely; avoid-list matches rank below
  // every clean dish (preferenceRank).
  const allowed = out.filter((i) => i && !i.diet_conflict);
  const scored = allowed.filter((i) => i.glycemic).sort((a, b) => preferenceRank(b) - preferenceRank(a));
  const unscored = allowed.filter((i) => !i.glycemic);
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
  // A call saved without a result (a tool that threw) can't be shown as done,
  // and sending it back made the server reject the whole chat. Skip it.
  const restored = calls
    .filter((c: any) => results.has(c?.toolCallId))
    .map((c: any) => ({
      toolCallId: c?.toolCallId,
      toolName: c?.toolName,
      args: c?.args,
      state: "result",
      result: results.get(c?.toolCallId)
    }));
  return restored.length ? restored : undefined;
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

/** How many search_menu results this message dropped for the person's diet. */
function dietExcluded(msg: any): number {
  let n = 0;
  for (const t of msg.toolInvocations ?? []) {
    if (t.state === "result" && t.toolName === "search_menu") n += Number(t.result?.diet_excluded) || 0;
  }
  return n;
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
