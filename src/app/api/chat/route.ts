import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToCoreMessages } from "ai";
import { buildToolset } from "@/lib/tools";
import type { UserProfile } from "@/lib/profile";
import { getSwiggyClient } from "@/lib/swiggy-mcp-client";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, provider, customModel, customApiKey } = body as {
    messages: any[];
    provider?: "openrouter" | "nvidia";
    customModel?: string;
    customApiKey?: string;
  };

  // Identity comes from the signed session, never from the request body — the
  // client must not be able to choose whose metabolic profile gets applied.
  const uid = await getSessionUid();
  if (!uid) {
    return new Response(JSON.stringify({ error: "Not signed in." }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const profile = await getProfile(uid);
  if (!profile) {
    return new Response(JSON.stringify({ error: "Finish onboarding first." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  const useNvidia = provider === "nvidia";
  const resolvedApiKey = customApiKey || (useNvidia ? process.env.NVIDIA_API_KEY : process.env.OPENROUTER_API_KEY);

  if (!resolvedApiKey) {
    return new Response(
      JSON.stringify({ error: "API Key is required. Please enter your API Key in the settings (BYOK) to test the product." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (useNvidia && !resolvedApiKey.startsWith("nvapi-")) {
    return new Response(
      JSON.stringify({ error: "Invalid API Key for NVIDIA. NVIDIA API keys must start with 'nvapi-'." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!useNvidia && !resolvedApiKey.startsWith("sk-or-v1-")) {
    return new Response(
      JSON.stringify({ error: "Invalid API Key for OpenRouter. OpenRouter API keys must start with 'sk-or-v1-'." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const aiProvider = createOpenAI({
    baseURL: useNvidia ? "https://integrate.api.nvidia.com/v1" : "https://openrouter.ai/api/v1",
    apiKey: resolvedApiKey,
    compatibility: "compatible",
    headers: useNvidia ? undefined : {
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      "X-Title": "GlycoCart"
    }
  });

  const swiggyClient = await getSwiggyClient();
  if (!swiggyClient) {
    return new Response(
      JSON.stringify({ error: "Your Swiggy session expired. Please sign in again." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const tools = buildToolset(profile, swiggyClient);
  const systemPrompt = buildSystemPrompt(profile);
  
  const defaultModel = useNvidia
    ? (process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b")
    : (process.env.OPENROUTER_MODEL ?? "anthropic/claude-3.5-sonnet");
  const modelChoice = customModel || defaultModel;
  
  const model = aiProvider(modelChoice);

  const result = streamText({
    model,
    system: systemPrompt,
    messages: convertToCoreMessages(messages),
    tools,
    maxSteps: 6,
    temperature: 0.4,
  });

  return result.toDataStreamResponse({
    getErrorMessage: (error: unknown) => {
      console.error("=== CHAT STREAM ERROR ===", error);
      return describeError(error);
    }
  });
}

/**
 * Providers throw plain objects as often as Errors, and `String(obj)` renders
 * "[object Object]" in the chat — which is what the user actually saw for an
 * NVIDIA 503. Pull out something readable, and translate the transient cases
 * into advice rather than jargon.
 */
function describeError(error: unknown): string {
  if (typeof error === "string") return error;

  const e = error as any;
  const raw =
    e?.message ??
    e?.error?.message ??
    e?.responseBody ??
    (error instanceof Error ? error.message : undefined);

  const status = e?.statusCode ?? e?.code ?? e?.status;

  if (status === 503 || /overload|unavailable|capacity/i.test(String(raw))) {
    return "The AI provider is overloaded right now. Wait a few seconds and send that again.";
  }
  if (status === 429 || /rate.?limit/i.test(String(raw))) {
    return "Rate limited by the AI provider. Give it a moment and try again.";
  }
  if (status === 401 || status === 403) {
    return "The AI provider rejected the API key. Check it in Settings.";
  }

  if (typeof raw === "string" && raw.trim()) return raw;
  try {
    return JSON.stringify(error);
  } catch {
    return "Something went wrong talking to the AI provider.";
  }
}

const TOOL_INSTRUCTIONS = `TOOL USE PATTERN:
1. The user's default addressId is given in their profile above. USE IT DIRECTLY —
   do not call get_addresses and do not ask the user where they are. They already
   chose this during setup; asking again is a step backwards.
   Only call get_addresses if the profile has no default address, or the user
   explicitly asks to order somewhere else. Never invent an addressId.
2. If they have NO saved address at all, tell them to add one in the Swiggy app —
   search cannot work without one.
3. "What should I eat / order me lunch" -> search_menu (it returns real dishes
   already scored for this user's glucose response).
4. "Find me a restaurant" -> search_restaurants, then get_restaurant_menu.
   Only recommend restaurants with availabilityStatus "OPEN".

HONESTY RULES — these matter more than being helpful:
- Glucose forecasts are ESTIMATES derived from matching the dish NAME against
  Indian food composition tables. Swiggy publishes no per-dish nutrition. Say
  "estimated" when you present them. Never imply lab-grade accuracy.
- estimate_confidence "archetype" means a category average that may be well off
  for that kitchen's actual recipe — flag those as rough.
- Items with glycemic: null could not be estimated. Present them as unscored.
  NEVER invent a peak, score, or macro number for them.
- The user's carb sensitivity and baseline are themselves estimates from an
  onboarding questionnaire, not measurements. Don't overstate their precision.
- Ordering is NOT yet wired to the real Swiggy cart. If the user wants to
  actually order, tell them to complete it in the Swiggy app for now. Never
  pretend to have placed an order.`;

function buildSystemPrompt(profile: UserProfile) {
  const m = profile.metabolic;
  return `You are GlycoCart, a glucose-aware ordering agent for Indian users managing metabolic health.

USER PROFILE:
- Name: ${profile.displayName}
- Default delivery addressId: ${profile.defaultAddressId ?? "NONE SAVED — call get_addresses"}
- Delivers to: ${profile.defaultAddressLabel ?? "unknown"}
- Condition: ${profile.conditionLabel}
- Goal: ${profile.goal === "lose" ? "lose weight" : profile.goal === "gain" ? "gain weight" : "maintain weight"}
- Dietary preferences: ${profile.dietary.join(", ") || "none stated"}
- Foods to avoid: ${profile.blocklist.join(", ") || "none stated"}
- Daily calorie target: ${profile.dailyCalTarget} kcal
- Fasting glucose baseline: ${m.fastingBaseline} mg/dL (estimated)
- Known trigger foods: ${m.triggers.join(", ") || "none stated"}
- Known safe foods: ${m.safeFoods.join(", ") || "none stated"}

HOW THIS PROFILE WAS BUILT (share if the user asks why a number looks the way it does):
${m.derivation.map((d) => `- ${d}`).join("\n")}

YOUR JOB:
1. Help the user order food from Swiggy that fits their metabolic profile.
2. Use the tools to find real restaurants and dishes with personalised glucose estimates.
3. Always explain WHY a recommendation works for their body — cite fibre, protein,
   glycemic load, or trigger-food avoidance.
4. Be concise. Indians value directness. Avoid over-explanation.
5. Respect their stated dietary preferences and avoid list without being asked twice.

CRITICAL CONSTRAINTS:
- Swiggy MCP is COD-only at this time.
- You are NOT a doctor. For medical decisions, defer to the user's healthcare provider.

${TOOL_INSTRUCTIONS}

OUTPUT FORMAT — the UI renders your text as PLAIN TEXT, not markdown:
- Never use markdown tables, ** bold **, or # headings. They render as literal
  pipes and asterisks and look broken.
- The dish cards shown above your message already list name, price, calories,
  carbs and predicted peak. Do NOT repeat that data in a table.
- Instead write 2-4 short sentences: which option you'd pick, why it suits this
  user's profile, and any caveat. Reference dishes by name.
- Keep it under 80 words unless the user asks for detail.`;
}
