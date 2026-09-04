"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check, Loader2, LogOut, MapPin, RefreshCw, Trash2, AlertTriangle,
  ChevronDown, Search, Eye, EyeOff, CheckCircle2, XCircle, Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadAiSettings, saveAiSettings, keyLooksValid, DEFAULT_MODEL_LABEL, KEY_PREFIX,
  type AiSettings, type Provider, DEFAULTS
} from "@/lib/ai-settings";

interface Address {
  id: string;
  addressLine: string;
  tag: string | null;
  category: string | null;
}

export function SettingsView({
  currentAddressId,
  currentAddressLabel
}: {
  currentAddressId?: string;
  currentAddressLabel?: string;
}) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [addrBusy, setAddrBusy] = useState(false);
  const [selected, setSelected] = useState(currentAddressId);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<"signout" | "delete" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/swiggy/context");
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setAddresses(data.addresses ?? []);
      } catch {
        if (!cancelled) setAddresses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function chooseAddress(addr: Address) {
    setAddrBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/address", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultAddressId: addr.id, defaultAddressLabel: addr.addressLine })
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save that address.");
      setSelected(addr.id);
      setNotice("Delivery address updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that address.");
    } finally {
      setAddrBusy(false);
    }
  }

  async function signOut() {
    setBusy("signout");
    await fetch("/api/session", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function deleteEverything() {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch("/api/session", { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Deletion failed.");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deletion failed.");
      setBusy(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Delivery address */}
      <section className="card-solid p-5">
        <h2 className="section-label mb-3">Delivery address</h2>

        {addresses === null && (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 size={14} className="animate-spin" /> Loading your saved addresses…
          </p>
        )}

        {addresses?.length === 0 && (
          <p className="text-sm text-ink-soft leading-relaxed">
            No saved addresses on your Swiggy account. Add one in the Swiggy app;
            restaurant search needs a delivery address.
          </p>
        )}

        <div className="grid gap-2">
          {addresses?.map((addr) => (
            <button
              key={addr.id}
              type="button"
              disabled={addrBusy}
              onClick={() => chooseAddress(addr)}
              className={cn(
                "text-left rounded-xl border px-4 py-3 transition-colors flex items-start gap-3 disabled:opacity-60",
                selected === addr.id
                  ? "border-leaf bg-leaf-pale/40"
                  : "border-ink/10 bg-cream hover:bg-cream-deep"
              )}
            >
              <MapPin size={15} className="text-ink-muted mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">
                {(addr.tag || addr.category) && (
                  <span className="section-label block mb-0.5">
                    {[addr.tag, addr.category].filter(Boolean).join(" · ")}
                  </span>
                )}
                <span className="block text-sm line-clamp-2">{addr.addressLine}</span>
              </span>
              {selected === addr.id && <Check size={16} className="text-leaf-text shrink-0 mt-0.5" />}
            </button>
          ))}
        </div>

        {notice && <p className="text-sm text-leaf-text mt-3">{notice}</p>}
      </section>

      {/* Model — moved here from a gear inside the chat screen. */}
      <AiSection />

      {/* Swiggy connection */}
      <section className="card-solid p-5">
        <h2 className="section-label mb-3">Swiggy account</h2>
        <p className="text-sm text-ink-soft leading-relaxed mb-4">
          {currentAddressLabel
            ? "Connected. Restaurants, menus and prices come from your own Swiggy account."
            : "Connected."}
        </p>
        <a href="/api/auth/swiggy/login" className="btn-ghost border border-ink/10 rounded-full">
          <RefreshCw size={14} /> reconnect swiggy
        </a>
      </section>

      {/* Account */}
      <section className="card-solid p-5">
        <h2 className="section-label mb-3">Account</h2>
        <button
          type="button"
          onClick={signOut}
          disabled={busy !== null}
          className="btn-ghost border border-ink/10 rounded-full disabled:opacity-60"
        >
          {busy === "signout" ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          sign out
        </button>
      </section>

      {/* Data deletion */}
      <section className="rounded-2xl border border-ember/30 bg-ember-soft/15 p-5">
        <h2 className="text-xs font-medium text-ember-text mb-3">Delete my data</h2>
        <p className="text-sm text-ink-soft leading-relaxed mb-4">
          Permanently deletes your profile (condition, numbers, food preferences and
          saved address) and signs you out. Your Swiggy account and order history are
          not affected. This cannot be undone.
        </p>

        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-2 rounded-full border border-ember/40 px-4 py-2 text-sm text-ember-text hover:bg-ember-soft/30 transition-colors"
          >
            <Trash2 size={14} /> delete my data
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm text-ember-text">
              <AlertTriangle size={14} /> Are you sure?
            </span>
            <button
              type="button"
              onClick={deleteEverything}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-full bg-ember text-on-accent px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {busy === "delete" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              yes, delete everything
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn-ghost">
              cancel
            </button>
          </div>
        )}
      </section>

      {/* The standing disclaimer. It used to sit under the chat composer on every
          screenful; this is where a permanent statement actually belongs. */}
      <section className="card-solid p-5">
        <h2 className="section-label mb-3">About</h2>
        <p className="text-sm text-ink-soft leading-relaxed">
          Restaurants, menus, prices and orders are live from your own Swiggy account
          through Swiggy&apos;s MCP. Glucose figures are estimates from dish names matched
          against Indian food composition tables. Swiggy publishes no per-dish nutrition.
          GlycoCart is not medical advice and does not place orders or book tables.
        </p>
      </section>

      {error && <p className="text-sm text-ember-text">{error}</p>}
    </div>
  );
}

/**
 * Bring-your-own-key model settings.
 *
 * Lives here, not in the chat: "Put general, infrequently changed settings in
 * your custom settings area" (Apple HIG, Settings).
 */
function AiSection() {
  const [ai, setAi] = useState<AiSettings>(DEFAULTS);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [keyStatus, setKeyStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

  useEffect(() => setAi(loadAiSettings()), []);

  function update(patch: Partial<AiSettings>) {
    const next = { ...ai, ...patch };
    setAi(next);
    saveAiSettings(next);
  }

  useEffect(() => {
    if (ai.apiKey && !keyLooksValid(ai.provider, ai.apiKey)) {
      setKeyStatus("invalid");
      return;
    }
    if (!ai.apiKey) setKeyStatus("idle");

    const t = setTimeout(async () => {
      setLoadingModels(true);
      if (ai.apiKey) setKeyStatus("checking");
      try {
        const res = await fetch("/api/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: ai.provider, customApiKey: ai.apiKey })
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.models)) {
            setModels(data.models);
            if (ai.apiKey) setKeyStatus("valid");
          }
        } else if (ai.apiKey) {
          setKeyStatus("invalid");
        }
      } catch {
        if (ai.apiKey) setKeyStatus("invalid");
      } finally {
        setLoadingModels(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [ai.provider, ai.apiKey]);

  return (
    <section className="card-solid p-5">
      <h2 className="section-label mb-1">Model</h2>
      <p className="text-sm text-ink-muted leading-relaxed mb-4">
        GlycoCart runs on {DEFAULT_MODEL_LABEL} by default. Bring your own key to use a
        different one. It stays in this browser and is only sent to the provider you pick.
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="section-label">Provider</span>
          <select
            value={ai.provider}
            onChange={(e) => update({ provider: e.target.value as Provider, model: "" })}
            className="mt-1.5 w-full bg-cream border border-ink/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-leaf"
          >
            <option value="nvidia">NVIDIA</option>
            <option value="openrouter">OpenRouter</option>
          </select>
        </label>

        <label className="block">
          <span className="section-label">Model</span>
          <ModelCombobox
            models={models}
            value={ai.model}
            onChange={(model) => update({ model })}
            isLoading={loadingModels}
          />
        </label>

        <label className="block">
          <span className="section-label">API key (optional)</span>
          <span className="relative mt-1.5 block">
            <input
              type={showKey ? "text" : "password"}
              placeholder={KEY_PREFIX[ai.provider] + "…"}
              value={ai.apiKey}
              onChange={(e) => update({ apiKey: e.target.value })}
              className={cn(
                "bg-cream border rounded-xl pl-3 pr-16 py-2.5 text-sm w-full outline-none transition-colors",
                keyStatus === "valid"
                  ? "border-leaf"
                  : keyStatus === "invalid"
                    ? "border-ember"
                    : "border-ink/10 focus:border-leaf"
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {keyStatus === "checking" && <Loader2 size={14} className="text-leaf animate-spin" />}
              {keyStatus === "valid" && <CheckCircle2 size={14} className="text-leaf-text" />}
              {keyStatus === "invalid" && <XCircle size={14} className="text-ember-text" />}
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="text-ink-muted hover:text-ink transition-colors"
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </span>
          </span>
          {keyStatus === "invalid" && (
            <span className="block text-xs text-ember-text mt-1.5">
              A {ai.provider} key starts with {KEY_PREFIX[ai.provider]}
            </span>
          )}
        </label>
      </div>
    </section>
  );
}

function ModelCombobox({
  models, value, onChange, isLoading
}: {
  models: any[]; value: string; onChange: (val: string) => void; isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = models.filter(
    (m) =>
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.id.toLowerCase().includes(query.toLowerCase())
  );
  const selected = models.find((m) => m.id === value);

  return (
    <span className="relative block mt-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 bg-cream border border-ink/10 rounded-xl px-3 py-2.5 text-sm hover:border-leaf transition-colors text-left"
      >
        <span className="flex-1 truncate">
          {isLoading ? "Loading models…" : selected ? selected.name : value || `${DEFAULT_MODEL_LABEL} (default)`}
        </span>
        <ChevronDown size={15} className="text-ink-muted shrink-0" />
      </button>

      {open && (
        <>
          <span className="fixed inset-0 z-40 block" onClick={() => setOpen(false)} />
          <span className="absolute top-full mt-1 left-0 right-0 z-50 bg-cream border border-ink/10 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-72 animate-fade-up">
            <span className="p-2 border-b border-ink/5 bg-cream-warm block">
              <span className="flex items-center gap-2 bg-cream border border-ink/10 rounded-lg px-2 py-1.5 focus-within:border-leaf transition-colors">
                <Search size={13} className="text-ink-muted" />
                <input
                  autoFocus
                  className="bg-transparent border-none outline-none text-sm flex-1 min-w-0"
                  placeholder="Search models…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </span>
            </span>
            <span className="overflow-y-auto flex-1 p-1 block">
              {filtered.map((m) => {
                const isFree =
                  parseFloat(m.pricing?.prompt) === 0 && parseFloat(m.pricing?.completion) === 0;
                return (
                  <span
                    key={m.id}
                    onClick={() => { onChange(m.id); setOpen(false); setQuery(""); }}
                    className={cn(
                      "flex flex-col gap-1 p-2.5 rounded-lg cursor-pointer transition-colors",
                      value === m.id ? "bg-leaf-pale" : "hover:bg-cream-warm"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate flex-1">{m.name}</span>
                      {isFree ? (
                        <span className="mono text-xs text-leaf-text shrink-0">free</span>
                      ) : (
                        <span className="mono text-xs text-ink-muted shrink-0 inline-flex items-center gap-1">
                          paid <Info size={9} />
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-xs text-ink-muted truncate">{m.id}</span>
                  </span>
                );
              })}
              {filtered.length === 0 && (
                <span className="block p-4 text-center text-sm text-ink-muted">No models found</span>
              )}
            </span>
          </span>
        </>
      )}
    </span>
  );
}
