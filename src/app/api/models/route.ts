import { NextResponse } from "next/server";
import { getSessionUid } from "@/lib/session";
import { resolveAiConfig } from "@/lib/ai-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ModelView {
  id: string;
  name: string;
  provider: string;
  context_length: number | null;
  pricing: { prompt: string; completion: string };
}

/**
 * Model list for the Settings picker. Signed-in only: it calls the provider
 * with the server's key when the user has none, and that key is ours to spend.
 * Same key rules as /api/chat, so OpenRouter lists only on the user's own key.
 */
export async function POST(req: Request) {
  if (!(await getSessionUid())) {
    return NextResponse.json({ error: "You're signed out. Sign in again to load models.", reason: "session" }, { status: 401 });
  }

  let body: { provider?: unknown; customApiKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const ai = resolveAiConfig(body, process.env);
  if (!ai.ok) {
    // "config": nothing will run until a key is added, so the UI must not
    // promise that the default works.
    return NextResponse.json({ error: ai.error, reason: ai.status === 401 ? "config" : "key" }, { status: ai.status });
  }

  try {
    const response = await fetch(`${ai.baseURL}/models`, {
      headers: { Authorization: `Bearer ${ai.apiKey}`, "Content-Type": "application/json" },
      cache: "no-store"
    });
    if (!response.ok) {
      const status = response.status === 401 || response.status === 403 ? 401 : 502;
      return NextResponse.json(
        {
          error: status === 401 ? "The provider rejected that API key." : `The provider returned ${response.status}.`,
          reason: status === 401 ? "key" : "provider"
        },
        { status }
      );
    }

    const data = (await response.json()) as { data?: any[] };
    const models: ModelView[] = (data.data ?? []).map((m: any) =>
      ai.provider === "nvidia"
        ? {
            id: m.id,
            name: String(m.id).split("/").pop() || m.id,
            provider: m.owned_by || "nvidia",
            context_length: null,
            pricing: { prompt: "0", completion: "0" }
          }
        : {
            id: m.id,
            name: m.name || m.id,
            provider: String(m.id).split("/")[0] || "openrouter",
            context_length: m.context_length ?? null,
            pricing: m.pricing || { prompt: "0", completion: "0" }
          }
    );

    const unique = Array.from(new Map(models.map((m) => [m.id, m])).values());
    return NextResponse.json({ models: unique });
  } catch (err) {
    console.error("Model list fetch failed", err);
    return NextResponse.json({ error: "Couldn't reach the provider." }, { status: 502 });
  }
}
