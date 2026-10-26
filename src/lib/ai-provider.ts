/**
 * Which LLM endpoint, key and model a request runs on.
 *
 * The server's own key is NVIDIA only, because NVIDIA's hosted models are free
 * to us. OpenRouter bills per token, and the model picker lists every model it
 * sells, so a server OpenRouter key would let any signed-in user choose the most
 * expensive model and charge it to us. OpenRouter therefore always runs on the
 * user's own key, and the server never reads one.
 *
 * Pure: takes env as an argument so it can be tested without a runtime.
 */

export type Provider = "nvidia" | "openrouter";

export interface AiRequest {
  provider?: unknown;
  customApiKey?: unknown;
  customModel?: unknown;
}

export type AiConfig =
  | { ok: true; provider: Provider; baseURL: string; apiKey: string; model: string; usingServerKey: boolean }
  | { ok: false; status: 400 | 401; error: string };

export const BASE_URL: Record<Provider, string> = {
  nvidia: "https://integrate.api.nvidia.com/v1",
  openrouter: "https://openrouter.ai/api/v1"
};

export const KEY_PREFIX: Record<Provider, string> = {
  nvidia: "nvapi-",
  openrouter: "sk-or-v1-"
};

export const DEFAULT_NVIDIA_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";
export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-3.5-sonnet";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function resolveAiConfig(req: AiRequest, env: Record<string, string | undefined>): AiConfig {
  const provider: Provider = req.provider === "openrouter" ? "openrouter" : "nvidia";
  const customKey = str(req.customApiKey);
  const customModel = str(req.customModel);

  if (provider === "openrouter") {
    if (!customKey) {
      return {
        ok: false,
        status: 401,
        error: "OpenRouter needs your own API key. Add one in Settings, or switch to NVIDIA, which is free."
      };
    }
    if (!customKey.startsWith(KEY_PREFIX.openrouter)) {
      return { ok: false, status: 400, error: "That isn't an OpenRouter key. OpenRouter keys start with 'sk-or-v1-'." };
    }
    return {
      ok: true,
      provider,
      baseURL: BASE_URL.openrouter,
      apiKey: customKey,
      model: customModel || str(env.OPENROUTER_MODEL) || DEFAULT_OPENROUTER_MODEL,
      usingServerKey: false
    };
  }

  const apiKey = customKey || str(env.NVIDIA_API_KEY);
  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      error: "No NVIDIA key is configured on this server. Add your own in Settings."
    };
  }
  if (!apiKey.startsWith(KEY_PREFIX.nvidia)) {
    return { ok: false, status: 400, error: "That isn't an NVIDIA key. NVIDIA keys start with 'nvapi-'." };
  }
  return {
    ok: true,
    provider,
    baseURL: BASE_URL.nvidia,
    apiKey,
    // Any NVIDIA model is free, so the user's choice is honoured on either key.
    model: customModel || str(env.NVIDIA_MODEL) || DEFAULT_NVIDIA_MODEL,
    usingServerKey: !customKey
  };
}
