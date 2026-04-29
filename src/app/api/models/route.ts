import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider, customApiKey } = body as {
      provider: "openrouter" | "nvidia";
      customApiKey?: string;
    };

    const useNvidia = provider === "nvidia";
    const resolvedApiKey = customApiKey || (useNvidia ? process.env.NVIDIA_API_KEY : process.env.OPENROUTER_API_KEY);

    if (!resolvedApiKey) {
      return NextResponse.json(
        { error: `${useNvidia ? 'NVIDIA_API_KEY' : 'OPENROUTER_API_KEY'} not set or provided.` },
        { status: 400 }
      );
    }

    const url = useNvidia 
      ? "https://integrate.api.nvidia.com/v1/models" 
      : "https://openrouter.ai/api/v1/models";

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${resolvedApiKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models from ${provider}: ${response.statusText}`);
    }

    const data = await response.json();
    
    let models: any[] = [];
    if (useNvidia) {
      models = data.data.map((m: any) => ({
        id: m.id,
        name: m.id.split('/').pop() || m.id,
        provider: m.owned_by || 'nvidia',
        context_length: null,
        pricing: { prompt: "0", completion: "0" }
      }));
    } else {
      models = data.data.map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        provider: m.id.split('/')[0] || 'openrouter',
        context_length: m.context_length,
        pricing: m.pricing || { prompt: "0", completion: "0" }
      }));
    }

    // Remove duplicates based on model id
    const uniqueModels = Array.from(new Map(models.map(m => [m.id, m])).values());

    return NextResponse.json({ models: uniqueModels });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
