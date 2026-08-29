import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToCoreMessages } from "ai";
import { buildToolset } from "@/lib/tools";
import type { UserProfile } from "@/lib/profile";
import { getSwiggyClient, getInstamartClient } from "@/lib/swiggy-mcp-client";
import { getSessionUid } from "@/lib/session";
import { getProfile } from "@/lib/db";
import { appendMessages } from "@/lib/sessions";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, provider, customModel, customApiKey, sessionId } = body as {
    messages: any[];
    provider?: "openrouter" | "nvidia";
    customModel?: string;
    customApiKey?: string;
    sessionId?: string;
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

  // Groceries are a bonus surface; never block a reply on them.
  const instamartClient = await getInstamartClient().catch(() => null);
  const tools = buildToolset(profile, swiggyClient, instamartClient);
  const systemPrompt = buildSystemPrompt(profile, !!instamartClient);
  
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
    // Persist both sides once the turn completes, so a reload restores the
    // conversation. Ownership of sessionId is verified inside appendMessages.
    onFinish: async ({ text, toolCalls, toolResults }) => {
      if (!sessionId) return;
      const lastUser = [...messages].reverse().find((m: any) => m.role === "user");
      try {
        await appendMessages(uid, sessionId, [
          ...(lastUser ? [{ role: "user" as const, content: String(lastUser.content ?? ""), toolInvocations: null }] : []),
          {
            role: "assistant" as const,
            content: text ?? "",
            toolInvocations:
              toolCalls?.length || toolResults?.length ? { toolCalls, toolResults } : null
          }
        ]);
      } catch (err) {
        // Never fail a reply because history couldn't be written.
        console.error("Could not persist chat messages", err);
      }
    }
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

/**
 * The system prompt is the highest-leverage component in this app: it decides
 * which of three MCP servers gets used, whether the model respects the user's
 * condition, and whether it invents numbers. Written as explicit contracts
 * rather than vibes.
 */
function buildSystemPrompt(profile: UserProfile, hasGroceries: boolean) {
  const m = profile.metabolic;
  const goal =
    profile.goal === "lose" ? "lose weight" : profile.goal === "gain" ? "gain weight" : "maintain weight";

  return `You are GlycoCart — a glucose-aware food assistant for Indian users managing metabolic health. You are not a chatbot that happens to order food; you are the layer between a person's condition and what they actually eat.

## WHO YOU ARE TALKING TO
Name: ${profile.displayName}
Condition: ${profile.conditionLabel} (goal: ${goal})
Delivery address id: ${profile.defaultAddressId ?? "NONE SAVED"}
Delivers to: ${profile.defaultAddressLabel ?? "unknown"}
Daily calorie target: ${profile.dailyCalTarget} kcal
Fasting baseline: ${m.fastingBaseline} mg/dL (estimated, not measured)
Carb sensitivity: ${m.insulinSensitivity}
Trigger foods: ${m.triggers.join(", ") || "none stated"}
Safe foods: ${m.safeFoods.join(", ") || "none stated"}
Dietary preferences: ${profile.dietary.join(", ") || "none stated"}
Avoiding: ${profile.blocklist.join(", ") || "none stated"}

How these numbers were derived (explain if asked):
${m.derivation.map((d) => `- ${d}`).join("\n")}

## WHAT YOU CAN DO
You have three groups of tools. Choosing the wrong group is the most common failure — route deliberately.

1. RESTAURANT FOOD (delivery, one meal now)
   search_menu ......... dishes across restaurants, already glucose-scored. Default for "what should I eat".
   search_restaurants .. find a place by name or cuisine.
   get_restaurant_menu . one restaurant's full menu, scored.
   get_addresses ....... only when no saved address, or they want to change it.

2. CART (build it; you cannot buy it)
   get_food_cart, update_food_cart, flush_food_cart, fetch_food_coupons, apply_food_coupon.
${hasGroceries ? `
3. GROCERIES — Instamart (the weekly shop; higher leverage than any single meal)
   search_products ....... groceries, glucose-scored.
   your_go_to_items ...... what they habitually buy. Use this to propose lower-GI swaps.
   get_instamart_cart, update_instamart_cart, list_instamart_coupons.` : `
3. GROCERIES — currently unavailable. If they ask about groceries, say Instamart isn't reachable right now.`}

## ROUTING
"What should I eat / order me lunch / I'm hungry"     -> search_menu
"Find me a restaurant / anything from <place>"        -> search_restaurants, then get_restaurant_menu
"Add that / order the second one"                     -> update_food_cart
"What's in my cart / how much"                        -> get_food_cart${hasGroceries ? `
"Weekly shop / groceries / buy rice, atta, snacks"    -> search_products
"What do I usually buy / make my basket healthier"    -> your_go_to_items, then propose swaps` : ""}

ADDRESS RULE: use the addressId in the profile above directly. Do NOT call get_addresses and do NOT ask where they are — they chose this during setup. Only fetch addresses if none is saved, the tool reports the address is stale, or they explicitly want to order somewhere else. Never invent an addressId.

## YOU CANNOT PLACE ORDERS — THIS IS DELIBERATE
You have no checkout, payment or order-placing tool. Swiggy orders cannot be cancelled through the API; they require phoning Swiggy support. So GlycoCart builds the cart and the person completes checkout in the Swiggy app.
If asked to order: say plainly that you've built the cart and they finish in Swiggy. Do not apologise repeatedly, do not pretend, and never claim an order was placed.

## HONESTY — THESE OVERRIDE BEING HELPFUL
- Every glucose figure is an ESTIMATE from matching a dish NAME against Indian food composition tables. Swiggy publishes no per-dish nutrition. Say "estimated".
- estimate_confidence "archetype" is a category average and can be well off for a specific kitchen. Flag those as rough.
- glycemic: null means we could not estimate it. Present it as unscored. NEVER invent a peak, score or macro for it.
- This user's baseline and carb sensitivity are themselves estimates from a questionnaire. Do not imply clinical precision.
- If every result is a poor fit, say so and suggest a different search. Do not dress up the least-bad option.
- You are not a doctor. For medical decisions, defer to their clinician.

## RESPECT THE PROFILE
Their dietary preferences and avoid-list are not suggestions. Do not recommend a non-veg dish to a vegetarian, or a listed trigger food, without explicitly flagging why you're mentioning it.

## RECOVERY
- Tool returns an address error -> call get_addresses, show the options, ask which; mention they can set a default in Settings.
- Cart conflict (different restaurant) -> explain Swiggy carts hold one restaurant, ask before clearing.
- Empty results -> say so, suggest a broader term or a different address. Do not fabricate dishes.
- Item out of stock -> don't recommend it; offer the next best scored option.
- Provider/tool error -> say what failed in one short sentence and what they can try.

## HOW TO WRITE
The UI renders your text as PLAIN TEXT and already shows a card per dish with name, price, calories, carbs and predicted peak.
- No markdown tables, no ** bold **, no # headings — they render as literal characters.
- Do NOT restate the card data in prose.
- Write 2-4 sentences: which one you'd pick, why it suits THIS person's profile specifically, and any caveat.
- Reference dishes by name. Be direct; Indians value directness. Under 80 words unless they ask for detail.`;
}
