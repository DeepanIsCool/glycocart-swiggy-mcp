/**
 * Makes a client-sent chat history safe to convert for the model.
 *
 * The AI SDK's convertToCoreMessages throws when a tool invocation has no
 * result. Two real paths produced one: tapping Stop while a tool ran (useChat
 * keeps the call in state "call"), and a tool that threw mid-turn (the call was
 * saved without a result and came back on reopen). Either way every later
 * message in that chat failed with a 500, and only "New chat" escaped.
 *
 * Unresolved calls are dropped. An assistant message left with neither text
 * nor resolved calls is dropped too. Pure, so it can be tested without the SDK.
 */

export interface UiMessage {
  role: string;
  content?: unknown;
  toolInvocations?: unknown;
  [key: string]: unknown;
}

function resolved(inv: any): boolean {
  return inv && typeof inv === "object" && inv.state === "result" && "result" in inv;
}

export function sanitizeHistory(messages: unknown): UiMessage[] {
  if (!Array.isArray(messages)) return [];
  const out: UiMessage[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const msg = m as UiMessage;
    // The history comes from the browser. A "system" message in it reached the
    // model as an instruction beside ours, so any visitor could rewrite the
    // prompt (scope, honesty rules) on the server's own key. Only the two
    // conversational roles are the client's to send.
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    if (msg.role !== "assistant" || !Array.isArray(msg.toolInvocations)) {
      out.push(msg);
      continue;
    }
    const kept = (msg.toolInvocations as unknown[]).filter(resolved);
    const hasText = typeof msg.content === "string" && msg.content.trim().length > 0;
    if (!hasText && kept.length === 0) continue;
    out.push({ ...msg, toolInvocations: kept.length ? kept : undefined });
  }
  return out;
}

/**
 * The model never needs a dish's 18-point glucose curve (the cards draw it from
 * client state), but the whole history, results included, is resent every turn.
 * A 100-dish menu carried roughly 20k tokens of curves. Strip them.
 */
export function slimToolResults(messages: UiMessage[]): UiMessage[] {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) if (k !== "curve") o[k] = strip(val);
      return o;
    }
    return v;
  };
  return messages.map((m) =>
    Array.isArray(m.toolInvocations)
      ? { ...m, toolInvocations: m.toolInvocations.map((inv: any) => ({ ...inv, result: strip(inv?.result) })) }
      : m
  );
}

/**
 * What to persist for one finished turn. Only calls that got a result are
 * kept, so a reopened chat never contains an unresolved call. Text is joined
 * across steps: the final step's `text` alone dropped anything the model said
 * before calling a tool.
 */
export function turnToStore(steps: { text?: string; toolCalls?: any[]; toolResults?: any[] }[]) {
  const results = steps.flatMap((s) => s.toolResults ?? []);
  const ids = new Set(results.map((r: any) => r?.toolCallId));
  const calls = steps.flatMap((s) => s.toolCalls ?? []).filter((c: any) => ids.has(c?.toolCallId));
  const text = steps
    .map((s) => (s.text ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
  return {
    text,
    toolInvocations: calls.length ? { toolCalls: calls, toolResults: results } : null
  };
}
