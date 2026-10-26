/**
 * The server's fallback key must never be spendable on a paid provider.
 *
 * Before this, /api/chat used OPENROUTER_API_KEY whenever the user left the key
 * blank, and honoured whatever model the browser sent. The Settings picker
 * lists every OpenRouter model, so any signed-in user could run the most
 * expensive one on our bill.
 *
 * Run: npm run test:ai-provider
 */
import assert from "node:assert";
import { resolveAiConfig, DEFAULT_NVIDIA_MODEL } from "./ai-provider";

const env = {
  NVIDIA_API_KEY: "nvapi-server",
  // Present on purpose: a leftover server OpenRouter key must still be ignored.
  OPENROUTER_API_KEY: "sk-or-v1-server"
};

// --- OpenRouter never touches a server key ----------------------------------
{
  const r = resolveAiConfig({ provider: "openrouter", customModel: "openai/o1-pro" }, env);
  assert.equal(r.ok, false, "OpenRouter without a user key must be refused");
  if (!r.ok) assert.equal(r.status, 401);
}
{
  const r = resolveAiConfig({ provider: "openrouter", customApiKey: "   " }, env);
  assert.equal(r.ok, false, "a whitespace key is no key");
}
{
  const r = resolveAiConfig({ provider: "openrouter", customApiKey: "nvapi-x" }, env);
  assert.equal(r.ok, false, "wrong-prefix key refused");
  if (!r.ok) assert.equal(r.status, 400);
}
{
  const r = resolveAiConfig(
    { provider: "openrouter", customApiKey: " sk-or-v1-user ", customModel: "openai/o1-pro" },
    env
  );
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.apiKey, "sk-or-v1-user", "user key used, trimmed");
    assert.equal(r.model, "openai/o1-pro", "user picks any model on their own key");
    assert.equal(r.usingServerKey, false);
  }
}

// --- NVIDIA falls back to the free server key -------------------------------
{
  const r = resolveAiConfig({}, env);
  assert.ok(r.ok, "no provider means NVIDIA");
  if (r.ok) {
    assert.equal(r.provider, "nvidia");
    assert.equal(r.apiKey, "nvapi-server");
    assert.equal(r.model, DEFAULT_NVIDIA_MODEL);
    assert.equal(r.usingServerKey, true);
  }
}
{
  const r = resolveAiConfig({ provider: "something-else" }, env);
  assert.ok(r.ok && r.provider === "nvidia", "unknown provider is NVIDIA, never OpenRouter");
}
{
  const r = resolveAiConfig({ provider: "nvidia", customModel: "meta/llama-3.3-70b-instruct" }, env);
  assert.ok(r.ok && r.model === "meta/llama-3.3-70b-instruct", "NVIDIA model choice honoured on server key");
}
{
  const r = resolveAiConfig({ provider: "nvidia", customApiKey: "nvapi-user" }, env);
  assert.ok(r.ok && r.apiKey === "nvapi-user" && !r.usingServerKey);
}
{
  const r = resolveAiConfig({ provider: "nvidia" }, {});
  assert.equal(r.ok, false, "no server key and no user key is refused");
}
{
  const r = resolveAiConfig({ provider: "nvidia", customApiKey: 42 as unknown }, env);
  assert.ok(r.ok && r.usingServerKey, "non-string key ignored, not crashed on");
}

console.log("ai-provider: all checks passed");
