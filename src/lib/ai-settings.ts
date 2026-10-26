"use client";

/**
 * Bring-your-own-key model settings.
 *
 * These used to live as React state inside the chat screen, behind a gear that
 * expanded a provider/model/API-key panel over the conversation. Apple's HIG is
 * explicit that general, infrequently-changed settings belong in the app's own
 * settings area, not in the middle of a task surface — so they moved to
 * Settings, and the chat reads them from here.
 *
 * Stored in localStorage: the API key is the user's own, it is only ever sent
 * to the provider they chose, and it must not be written to our database.
 */

import { KEY_PREFIX, type Provider } from "./ai-provider";

export { KEY_PREFIX, type Provider };

export interface AiSettings {
  provider: Provider;
  model: string;
  apiKey: string;
}

const KEY = "glycocart.ai";

export const DEFAULTS: AiSettings = { provider: "nvidia", model: "", apiKey: "" };

/** Label for the model that runs when the user has not chosen one. */
export const DEFAULT_MODEL_LABEL = "nemotron-3-ultra-550b";

export function loadAiSettings(): AiSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      provider: parsed?.provider === "openrouter" ? "openrouter" : "nvidia",
      model: typeof parsed?.model === "string" ? parsed.model : "",
      apiKey: typeof parsed?.apiKey === "string" ? parsed.apiKey : ""
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveAiSettings(s: AiSettings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
    // Same-tab listeners: the storage event only fires in OTHER tabs.
    window.dispatchEvent(new CustomEvent(CHANGED));
  } catch {
    /* private browsing, quota — the defaults still work */
  }
}

export const CHANGED = "glycocart:ai-settings";

/**
 * True when the key is well-formed, or empty on NVIDIA (the free server key is
 * used). OpenRouter has no server key, so an empty key there is not valid.
 */
export function keyLooksValid(provider: Provider, apiKey: string): boolean {
  const key = apiKey.trim();
  if (!key) return provider === "nvidia";
  return key.startsWith(KEY_PREFIX[provider]);
}
