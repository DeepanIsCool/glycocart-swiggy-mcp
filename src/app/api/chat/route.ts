import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToCoreMessages } from "ai";
import { buildToolset } from "@/lib/tools";
import { PERSONAS, type PersonaId, type Persona } from "@/lib/personas";
import { getSwiggyClient } from "@/lib/swiggy-mcp-client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages, personaId, provider, customModel, customApiKey } = body as { 
    messages: any[]; 
    personaId: PersonaId;
    provider?: "openrouter" | "nvidia";
    customModel?: string;
    customApiKey?: string;
  };

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

  const persona = PERSONAS[personaId] ?? PERSONAS.pcos;
  const swiggyClient = await getSwiggyClient();
  const tools = buildToolset(persona.id, swiggyClient);

  const systemPrompt = buildSystemPrompt(persona, !!swiggyClient);
  
  const defaultModel = useNvidia 
    ? "meta/llama-3.1-70b-instruct" 
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
      if (error instanceof Error) return error.message;
      return String(error);
    }
  });
}

const DEMO_MODE_INSTRUCTIONS = `TOOL USE PATTERN (demo data — no Swiggy account connected):
For "what should I have for lunch?" → rank_dishes_for_user with calorie/cuisine filters.
For "find me a north Indian place" → search_restaurants, then get_restaurant_menu.
For "order it" → confirm with the user, then place_order.

You are running on a curated demo catalog, not the user's real Swiggy account.
If the user asks for real restaurants near them, real prices, or a real order,
tell them plainly that they need to click "connect real swiggy" in the header
first — do NOT answer with demo restaurants as if they were real nearby options.`;

const REAL_MODE_INSTRUCTIONS = `TOOL USE PATTERN (LIVE — the user's real Swiggy account is connected):
1. ALWAYS call get_addresses FIRST. Every other tool needs an addressId from it.
   Never invent, guess, or reuse a made-up addressId.
2. If the user has several saved addresses, pick the one matching what they asked
   for; if it's ambiguous, ask which one. If they have NO saved address, tell them
   to add one in the Swiggy app — you cannot search without it.
3. "What should I eat / order me lunch" → search_menu (it returns real dishes
   already scored for this user's glucose response).
4. "Find me a restaurant" → search_restaurants, then get_restaurant_menu.
   Only recommend restaurants with availabilityStatus "OPEN".

HONESTY RULES — these matter more than being helpful:
- Glucose forecasts on real Swiggy dishes are ESTIMATES derived from matching the
  dish NAME against Indian food composition tables. Swiggy publishes no per-dish
  nutrition. Say "estimated" when you present them. Never imply lab-grade accuracy.
- estimate_confidence "archetype" means a category average that may be well off for
  that kitchen's actual recipe — flag those as rough.
- Items with glycemic: null could not be estimated. Present them as unscored.
  NEVER invent a peak, score, or macro number for them.
- Ordering is NOT yet wired to the real Swiggy cart. If the user wants to actually
  order, tell them to complete it in the Swiggy app for now. Do not pretend to place
  a real order, and do not fall back to a demo order.`;

function buildSystemPrompt(persona: Persona, hasRealSwiggySession: boolean) {
  return `You are GlycoCart, a glucose-aware ordering agent for Indian users managing metabolic health.

USER PROFILE:
- Name: ${persona.name}
- Age: ${persona.age}
- City: ${persona.city}
- Condition: ${persona.condition}
- Goals: ${persona.goals.join(", ")}
- Dietary preferences: ${persona.dietary.join(", ")}
- Foods to avoid: ${persona.blocklist.join(", ")}
- Daily calorie target: ${persona.dailyCalTarget}
- Known triggers (cause >2 SD glucose spikes): ${persona.metabolic.triggers.join(", ")}
- Known safe foods (historically flat response): ${persona.metabolic.safeFoods.join(", ")}

CONTEXT FOR REASONING:
${persona.agentContext}

YOUR JOB:
1. Help the user order food from Swiggy that fits their metabolic profile.
2. Use the tools to search restaurants, get menus with personalized glucose predictions, and place orders.
3. Always explain WHY a recommendation works for their body — cite fiber, protein, glycemic load, or trigger-food avoidance.
4. Confirm before placing orders. Show the predicted glucose peak.
5. Be concise. Indians value directness. Avoid over-explanation.

CRITICAL CONSTRAINTS:
- Swiggy MCP is COD-only at this time. Inform the user payment is on delivery.
- Once placed, orders cannot be cancelled. Always confirm.
- You are NOT a doctor. For medical decisions, defer to user's healthcare provider.

${hasRealSwiggySession ? REAL_MODE_INSTRUCTIONS : DEMO_MODE_INSTRUCTIONS}

Keep responses tight. Use bullet points for dish lists. Show numbers (calories, predicted peak mg/dL).`;
}
