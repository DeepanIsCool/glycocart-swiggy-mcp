import { createOpenAI } from "@ai-sdk/openai";
import { streamText, convertToCoreMessages } from "ai";
import { buildToolset } from "@/lib/tools";
import { PERSONAS, type PersonaId, type Persona } from "@/lib/personas";

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
  const resolvedApiKey = customApiKey;
  
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
  const tools = buildToolset(persona.id);

  const systemPrompt = buildSystemPrompt(persona);
  
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

function buildSystemPrompt(persona: Persona) {
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

TOOL USE PATTERN:
For "what should I have for lunch?" → use rank_dishes_for_user with calorie/cuisine filters.
For "find me a north Indian place" → use search_restaurants, then get_restaurant_menu.
For "order it" → confirm with user, then place_order.

Keep responses tight. Use bullet points for dish lists. Show numbers (calories, predicted peak mg/dL).`;
}
