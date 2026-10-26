"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquarePlus, Trash2, X, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
}

/** How long the delete button waits for its confirming second tap. */
const CONFIRM_MS = 3000;

/** "14:05" for today, "3 Oct" otherwise. A list of identical dates said little. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Conversation history. A drawer on mobile (there is no room for a permanent
 * rail next to a full-height chat), a docked column from `md` up.
 */
export function ChatSidebar({
  open,
  onClose,
  activeId,
  onSelect,
  onNew,
  refreshKey
}: {
  open: boolean;
  onClose: () => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  refreshKey: number;
}) {
  const [sessions, setSessions] = useState<ChatSessionSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  // The parent passes an inline closure; reading it through a ref keeps the
  // focus effect below from re-running (and re-stealing focus) every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    (async () => {
      try {
        const res = await fetch("/api/sessions");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setSessions(data.sessions ?? []);
      } catch {
        // This used to fall through to "No saved chats yet", which told
        // someone with twenty saved chats that they had none.
        if (!cancelled) {
          setSessions((prev) => prev ?? []);
          setLoadFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, retryKey]);

  // A pending "Delete" quietly reverts to the bin icon.
  useEffect(() => {
    if (!confirmId) return;
    const t = window.setTimeout(() => setConfirmId(null), CONFIRM_MS);
    return () => window.clearTimeout(t);
  }, [confirmId]);

  // Drawer behaves like a modal sheet: Escape closes it, focus moves into it
  // on open and back to whatever opened it on close.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    drawerRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [open]);

  const remove = useCallback(
    async (s: ChatSessionSummary) => {
      // Two taps. The bin is always visible on touch, right beside the row you
      // tap to open a chat, and a single mis-tap deleted it for good.
      if (confirmId !== s.id) {
        setConfirmId(s.id);
        return;
      }
      setConfirmId(null);
      setDeleteError(null);
      const before = sessions;
      setSessions((prev) => prev?.filter((x) => x.id !== s.id) ?? null);
      try {
        const res = await fetch(`/api/sessions/${s.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        if (s.id === activeId) onNew();
      } catch {
        // Optimistic removal used to stick even when the delete failed, so the
        // chat reappeared on the next visit with no explanation.
        setSessions(before);
        setDeleteError(`Couldn't delete "${s.title}". Try again.`);
      }
    },
    [confirmId, sessions, activeId, onNew]
  );

  const list = (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between pl-4 pr-1 h-14 shrink-0 border-b border-ink/8">
        <h2 className="text-sm font-medium text-ink">Chats</h2>
        <div className="flex items-center">
          <button
            type="button"
            onClick={onNew}
            className={cn("app-bar-action", "focus-ring")}
            aria-label="New chat"
          >
            <MessageSquarePlus size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn("app-bar-action md:hidden", "focus-ring")}
            aria-label="Close chat history"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain p-2">
        {sessions === null && (
          <div className="space-y-1" aria-busy="true" aria-label="Loading chats">
            {[72, 56, 64, 48].map((w) => (
              <div key={w} className="px-3 py-2.5 space-y-1.5" aria-hidden>
                <div
                  className="h-3.5 rounded skeleton"
                  style={{ width: `${w}%` }}
                />
                <div className="h-3 w-12 rounded skeleton" />
              </div>
            ))}
          </div>
        )}

        {loadFailed && (
          <div className="p-2 text-sm text-ink-muted leading-relaxed" role="alert">
            <p>Couldn&apos;t load your saved chats.</p>
            <button
              type="button"
              onClick={() => setRetryKey((k) => k + 1)}
              className={cn("btn-ghost -ml-3 mt-1 min-h-11 text-ink", "focus-ring")}
            >
              <RotateCw size={14} aria-hidden /> Try again
            </button>
          </div>
        )}

        {deleteError && (
          <p className="p-2 text-sm text-ember-text" role="alert">
            {deleteError}
          </p>
        )}

        {!loadFailed && sessions?.length === 0 && (
          <p className="text-sm text-ink-muted p-2 leading-relaxed">
            No saved chats yet. Ask something and it&apos;ll appear here.
          </p>
        )}

        <ul>
          {sessions?.map((s) => {
            const active = s.id === activeId;
            const confirming = confirmId === s.id;
            return (
              <li
                key={s.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg mb-0.5",
                  active ? "bg-leaf-pale/50" : "hover:bg-cream-deep"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn("flex-1 min-w-0 text-left px-3 py-2.5 rounded-lg", "focus-ring")}
                >
                  {/* Two lines, wrapping on words. A single truncated line cut most
                      real titles mid-word: "Show me open restaurants near my h…" */}
                  <span className="block text-sm leading-snug line-clamp-2 break-words">{s.title}</span>
                  <span className="block text-xs text-ink-muted mt-0.5">{formatWhen(s.updatedAt)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(s)}
                  aria-label={confirming ? `Confirm delete: ${s.title}` : `Delete chat: ${s.title}`}
                  className={cn(
                    "shrink-0 min-w-11 h-11 mr-0.5 rounded-full inline-flex items-center justify-center transition-colors",
                    confirming
                      ? "px-3 text-xs font-medium text-ember-text bg-ember/10"
                      : // Always visible on touch, where there is no hover to reveal it.
                        "text-ink-muted hover:text-ember-text md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100",
                    "focus-ring"
                  )}
                >
                  {confirming ? "Delete" : <Trash2 size={15} aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );

  return (
    <>
      {/*
        * Mobile drawer. It slides in from the edge it belongs to, instead of
        * fading up from the bottom like a toast. Kept mounted so the slide can
        * run both ways; `invisible` takes it out of the tab order and the
        * accessibility tree when closed.
        */}
      <div
        className={cn("md:hidden fixed inset-0 z-40", !open && "pointer-events-none")}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "absolute inset-0 bg-ink/40 transition-opacity duration-300 motion-reduce:transition-none",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={onClose}
        />
        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Chat history"
          className={cn(
            "absolute inset-y-0 left-0 w-[80%] max-w-xs bg-cream border-r border-ink/10 shadow-xl",
            "transition-[transform,visibility] duration-300 ease-out motion-reduce:transition-none",
            open ? "translate-x-0 visible" : "-translate-x-full invisible"
          )}
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "env(safe-area-inset-bottom)",
            paddingLeft: "env(safe-area-inset-left)"
          }}
        >
          {list}
        </div>
      </div>

      {/* Docked on wide screens */}
      <aside
        className="hidden md:flex flex-col w-72 shrink-0 border-r border-ink/10 bg-cream-warm/40"
        aria-label="Chat history"
      >
        {list}
      </aside>
    </>
  );
}
