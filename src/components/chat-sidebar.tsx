"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus, Trash2, X, History, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatSessionSummary {
  id: string;
  title: string;
  updatedAt: string;
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sessions");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setSessions(data.sessions ?? []);
      } catch {
        if (!cancelled) setSessions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function remove(id: string) {
    setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null);
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (id === activeId) onNew();
  }

  const list = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink/8">
        <span className="mono text-ink-muted text-xs">chats</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNew}
            className="text-ink-muted hover:text-ink transition-colors p-2 -m-1"
            aria-label="New chat"
          >
            <MessageSquarePlus size={17} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="md:hidden text-ink-muted hover:text-ink transition-colors p-2 -m-1"
            aria-label="Close chat history"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sessions === null && (
          <p className="flex items-center gap-2 text-sm text-ink-muted p-2">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </p>
        )}
        {sessions?.length === 0 && (
          <p className="text-sm text-ink-muted p-2 leading-relaxed">
            No saved chats yet. Ask something and it&apos;ll appear here.
          </p>
        )}
        {sessions?.map((s) => (
          <div
            key={s.id}
            className={cn(
              "group flex items-center gap-1 rounded-lg mb-0.5",
              s.id === activeId ? "bg-leaf-pale/50" : "hover:bg-cream-deep"
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className="flex-1 min-w-0 text-left px-3 py-2.5"
            >
              <span className="block text-sm truncate">{s.title}</span>
              <span className="block text-xs text-ink-muted mt-0.5">
                {new Date(s.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            </button>
            <button
              type="button"
              onClick={() => remove(s.id)}
              aria-label={`Delete chat: ${s.title}`}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-ink-muted hover:text-ember-text transition-all p-2 mr-1"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />
          <div className="relative w-[80%] max-w-xs bg-cream border-r border-ink/10 animate-fade-up">
            {list}
          </div>
        </div>
      )}

      {/* Docked on wide screens */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-ink/10 bg-cream-warm/40">{list}</aside>
    </>
  );
}

/** Trigger for the mobile drawer. */
export function ChatHistoryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="md:hidden text-ink-muted hover:text-ink transition-colors p-2 -m-2"
      aria-label="Chat history"
    >
      <History size={18} />
    </button>
  );
}
