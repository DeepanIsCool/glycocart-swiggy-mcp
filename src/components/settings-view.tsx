"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ChevronDown, Search, Eye, EyeOff, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadAiSettings, saveAiSettings, DEFAULT_MODEL_LABEL, KEY_PREFIX,
  type AiSettings, type Provider, DEFAULTS
} from "@/lib/ai-settings";

interface Address {
  id: string;
  addressLine: string;
  tag: string | null;
  category: string | null;
}

type AddressState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; list: Address[] };

const PROVIDER_LABEL: Record<Provider, string> = { nvidia: "NVIDIA", openrouter: "OpenRouter" };

/**
 * A grouped list section in the iOS Settings style: a sentence-case header
 * above the group, the rows in one card, and an optional footnote below.
 */
function Group({
  title,
  footer,
  message,
  children
}: {
  title: string;
  footer?: ReactNode;
  /** Result of an action in this group, shown where the action happened. */
  message?: { text: string; tone: "good" | "bad" } | null;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="section-label px-1 mb-2">
        {title}
      </h2>
      <div className="card-solid overflow-hidden divide-y divide-ink/10">{children}</div>
      {message && (
        <p
          className={cn("text-sm leading-relaxed px-1 mt-2", message.tone === "bad" ? "text-ember-text" : "text-leaf-text")}
          role={message.tone === "bad" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
      {footer && <div className="text-xs text-ink-muted leading-relaxed px-1 mt-2">{footer}</div>}
    </section>
  );
}

/**
 * Two-step destructive row. The first tap reveals what will happen and a
 * confirm button; nothing irreversible happens on a single tap.
 */
function ConfirmRow({
  label,
  question,
  detail,
  confirmLabel,
  busy,
  disabled,
  onConfirm
}: {
  label: string;
  question: string;
  detail: string;
  confirmLabel: string;
  busy: boolean;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const qid = useId();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full min-h-12 px-4 text-left text-sm font-medium text-ember-text hover:bg-cream-deep/60 transition-colors disabled:opacity-50"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="px-4 py-4" role="group" aria-labelledby={qid}>
      <p id={qid} className="text-sm font-medium">
        {question}
      </p>
      <p className="text-sm text-ink-muted leading-relaxed mt-1">{detail}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled}
          className="inline-flex items-center gap-2 min-h-11 px-4 rounded-full bg-ember text-on-accent text-sm font-medium disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          autoFocus
          className="inline-flex items-center min-h-11 px-4 rounded-full border border-ink/10 text-sm text-ink-soft hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SettingsView({
  currentAddressId,
  currentAddressLabel
}: {
  currentAddressId?: string;
  currentAddressLabel?: string;
}) {
  const router = useRouter();
  const [addresses, setAddresses] = useState<AddressState>({ status: "loading" });
  const [addrBusy, setAddrBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState(currentAddressId);
  const [addrNotice, setAddrNotice] = useState<string | null>(null);
  const [addrError, setAddrError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"signout" | "delete" | null>(null);

  async function loadAddresses() {
    setAddresses({ status: "loading" });
    try {
      const res = await fetch("/api/swiggy/context");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAddresses({ status: "ready", list: Array.isArray(data.addresses) ? data.addresses : [] });
    } catch {
      // Used to fall through to "no saved addresses on your Swiggy account",
      // which is false when the request simply failed.
      setAddresses({ status: "error" });
    }
  }

  useEffect(() => {
    loadAddresses();
  }, []);

  async function chooseAddress(addr: Address) {
    if (addr.id === selected) return;
    setAddrBusy(addr.id);
    setAddrError(null);
    setAddrNotice(null);
    try {
      const res = await fetch("/api/profile/address", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultAddressId: addr.id, defaultAddressLabel: addr.addressLine })
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save that address.");
      setSelected(addr.id);
      setAddrNotice("Delivery address updated. Your cart and search now use this address.");
      router.refresh();
    } catch (err) {
      setAddrError(err instanceof Error ? err.message : "Couldn't save that address.");
    } finally {
      setAddrBusy(null);
    }
  }

  async function signOut() {
    setBusy("signout");
    setAccountError(null);
    try {
      const res = await fetch("/api/session", { method: "POST" });
      if (!res.ok) throw new Error();
      router.push("/");
      router.refresh();
    } catch {
      setAccountError("Couldn't sign out. Check your connection and try again.");
      setBusy(null);
    }
  }

  async function deleteEverything() {
    setBusy("delete");
    setAccountError(null);
    try {
      const res = await fetch("/api/session", { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Deletion failed.");
      // The API key lives in this browser, not our database, so deleting the
      // server-side profile alone would leave it behind.
      saveAiSettings(DEFAULTS);
      router.push("/");
      router.refresh();
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : "Deletion failed.");
      setBusy(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-7">
      <Group
        title="Delivery address"
        message={
          addrError
            ? { text: addrError, tone: "bad" }
            : addrNotice
              ? { text: addrNotice, tone: "good" }
              : null
        }
        footer={
          addresses.status === "ready" && addresses.list.length > 0
            ? "Swiggy carts are per address. Use the same one in the Swiggy app when you check out."
            : undefined
        }
      >
        {addresses.status === "loading" && (
          <p className="flex items-center gap-2 px-4 py-3.5 text-sm text-ink-muted" role="status">
            <Loader2 size={14} className="animate-spin" aria-hidden /> Loading your saved addresses…
          </p>
        )}

        {addresses.status === "error" && (
          <div className="px-4 py-3.5" role="alert">
            <p className="text-sm text-ink-soft leading-relaxed">
              Couldn&apos;t load your Swiggy addresses.
              {currentAddressLabel && (
                <>
                  {" "}
                  Currently delivering to {currentAddressLabel}.
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={loadAddresses}
                className="inline-flex items-center min-h-11 px-4 rounded-full border border-ink/10 text-sm text-ink-soft hover:text-ink"
              >
                Try again
              </button>
              <a
                href="/api/auth/swiggy/login"
                className="inline-flex items-center min-h-11 px-4 rounded-full text-sm text-leaf-text hover:bg-cream-deep/60"
              >
                Reconnect Swiggy
              </a>
            </div>
          </div>
        )}

        {addresses.status === "ready" && addresses.list.length === 0 && (
          <p className="px-4 py-3.5 text-sm text-ink-soft leading-relaxed">
            No saved addresses on your Swiggy account. Add one in the Swiggy app, then come
            back here. Restaurant search needs a delivery address.
          </p>
        )}

        {addresses.status === "ready" &&
          addresses.list.map((addr) => {
            const isSelected = selected === addr.id;
            const label = [addr.tag, addr.category].filter(Boolean).join(", ");
            return (
              <button
                key={addr.id}
                type="button"
                disabled={addrBusy !== null}
                onClick={() => chooseAddress(addr)}
                aria-pressed={isSelected}
                className={cn(
                  "w-full min-h-12 text-left px-4 py-3 flex items-start gap-3 transition-colors disabled:opacity-60",
                  isSelected ? "bg-leaf-pale/40" : "hover:bg-cream-deep/60"
                )}
              >
                <span className="min-w-0 flex-1">
                  {label && <span className="block text-sm font-medium capitalize">{label}</span>}
                  <span className={cn("block text-sm line-clamp-2", label ? "text-ink-muted" : "text-ink")}>
                    {addr.addressLine}
                  </span>
                </span>
                <span className="size-5 shrink-0 mt-0.5 inline-flex items-center justify-center">
                  {addrBusy === addr.id ? (
                    <Loader2 size={15} className="animate-spin text-ink-muted" aria-hidden />
                  ) : (
                    isSelected && <Check size={17} className="text-leaf-text" aria-hidden />
                  )}
                </span>
              </button>
            );
          })}
      </Group>

      {/* Model, moved here from a gear inside the chat screen. */}
      <AiSection />

      <Group
        title="Swiggy account"
        footer="Restaurants, menus, prices and your cart come from your own Swiggy account. Reconnect if search or the cart stops loading."
      >
        <a
          href="/api/auth/swiggy/login"
          className="flex items-center justify-between w-full min-h-12 px-4 text-sm hover:bg-cream-deep/60 transition-colors"
        >
          <span>Reconnect Swiggy</span>
          {/* The address list is read from Swiggy, so it loading is proof the
              connection works. Anything else is not claimed. */}
          {addresses.status === "ready" && <span className="text-ink-muted text-sm">Connected</span>}
        </a>
      </Group>

      <Group
        title="Account"
        message={accountError ? { text: accountError, tone: "bad" } : null}
        footer="Deleting your data removes your profile from GlycoCart. Your Swiggy account, cart and order history are not affected."
      >
        <ConfirmRow
          label="Sign out"
          question="Sign out of GlycoCart?"
          detail="Your profile is kept for when you sign back in."
          confirmLabel="Sign out"
          busy={busy === "signout"}
          disabled={busy !== null}
          onConfirm={signOut}
        />
        <ConfirmRow
          label="Delete my data"
          question="Delete everything GlycoCart stores about you?"
          detail="This permanently deletes your condition, numbers, food preferences and saved address, removes the API key saved in this browser, and signs you out. It cannot be undone."
          confirmLabel="Delete my data"
          busy={busy === "delete"}
          disabled={busy !== null}
          onConfirm={deleteEverything}
        />
      </Group>

      {/* The standing disclaimer. It used to sit under the chat composer on every
          screenful; this is where a permanent statement belongs. */}
      <section aria-labelledby="about-heading" className="px-1">
        <h2 id="about-heading" className="section-label mb-2">
          About
        </h2>
        <p className="text-sm text-ink-soft leading-relaxed">
          Restaurants, menus, prices and orders are live from your own Swiggy account
          through Swiggy&apos;s MCP. Glucose figures are estimates from dish names matched
          against Indian food composition tables. Swiggy publishes no per-dish nutrition.
          GlycoCart is not medical advice and does not place orders or book tables.
        </p>
      </section>
    </div>
  );
}

interface ModelInfo {
  id: string;
  name: string;
  pricing?: { prompt?: string; completion?: string };
}

/**
 * idle      nothing to check (no key)
 * malformed wrong prefix for this provider, so not sent anywhere
 * checking  asking the provider for its model list with this key
 * valid     the provider accepted the key
 * rejected  the provider refused the key (401)
 * unverified the provider could not be reached, so we cannot say
 */
type KeyStatus = "idle" | "malformed" | "checking" | "valid" | "rejected" | "unverified";

/**
 * Bring-your-own-key model settings.
 *
 * Lives here, not in the chat: "Put general, infrequently changed settings in
 * your custom settings area" (Apple HIG, Settings).
 *
 * The server's free key is NVIDIA only. OpenRouter always runs on the user's
 * own key, so with OpenRouter selected and no key, chat will refuse and the
 * model list cannot load. That is said here, inline, before it fails in chat.
 */
function AiSection() {
  const [ai, setAi] = useState<AiSettings>(DEFAULTS);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle");
  const keyId = useId();
  const keyHelpId = useId();
  const modelLabelId = useId();

  useEffect(() => setAi(loadAiSettings()), []);

  function update(patch: Partial<AiSettings>) {
    const next = { ...ai, ...patch };
    setAi(next);
    saveAiSettings(next);
  }

  const key = ai.apiKey.trim();
  const providerName = PROVIDER_LABEL[ai.provider];
  const needsKey = ai.provider === "openrouter" && !key;

  useEffect(() => {
    let cancelled = false;
    setModels([]);
    setModelsError(null);

    if (needsKey) {
      setKeyStatus("idle");
      setLoadingModels(false);
      return;
    }
    if (key && !key.startsWith(KEY_PREFIX[ai.provider])) {
      setKeyStatus("malformed");
      setLoadingModels(false);
      return;
    }

    setKeyStatus(key ? "checking" : "idle");
    setLoadingModels(true);

    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: ai.provider, customApiKey: key })
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && Array.isArray(data.models)) {
          setModels(data.models as ModelInfo[]);
          if (key) setKeyStatus("valid");
        } else if (key && res.status === 401) {
          setKeyStatus("rejected");
        } else {
          if (key) setKeyStatus("unverified");
          setModelsError(typeof data.error === "string" ? data.error : "The model list didn't load.");
        }
      } catch {
        if (cancelled) return;
        if (key) setKeyStatus("unverified");
        setModelsError("The model list didn't load.");
      } finally {
        if (!cancelled) setLoadingModels(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ai.provider, key, needsKey]);

  const keyMessage: { text: string; tone: "muted" | "good" | "bad" } = needsKey
    ? {
        text: "OpenRouter needs your own API key. GlycoCart's free default runs on NVIDIA only, so chat won't work on OpenRouter until you add one.",
        tone: "bad"
      }
    : keyStatus === "malformed"
      ? { text: `That isn't an ${providerName} key. ${providerName} keys start with ${KEY_PREFIX[ai.provider]}`, tone: "bad" }
      : keyStatus === "checking"
        ? { text: `Checking the key with ${providerName}…`, tone: "muted" }
        : keyStatus === "valid"
          ? { text: `${providerName} accepted this key.`, tone: "good" }
          : keyStatus === "rejected"
            ? { text: `${providerName} rejected this key. Check it was copied in full.`, tone: "bad" }
            : keyStatus === "unverified"
              ? { text: `Couldn't reach ${providerName} to check this key.`, tone: "muted" }
              : { text: "Optional. Without a key, GlycoCart uses its free NVIDIA default.", tone: "muted" };

  const pickerBlocked = needsKey || keyStatus === "malformed" || keyStatus === "rejected";
  const defaultLabel =
    ai.provider === "nvidia" ? `${DEFAULT_MODEL_LABEL} (default)` : "OpenRouter default";

  return (
    <Group
      title="Model"
      footer={
        <>
          GlycoCart runs on {DEFAULT_MODEL_LABEL} through NVIDIA by default, at no cost to you.
          A key you add is saved in this browser. GlycoCart&apos;s server passes it to the provider you pick with each message and never stores it.
        </>
      }
    >
      <label className="flex items-center justify-between gap-3 min-h-12 px-4">
        <span className="text-sm">Provider</span>
        <span className="relative inline-flex items-center">
          <select
            value={ai.provider}
            onChange={(e) => update({ provider: e.target.value as Provider, model: "" })}
            className="appearance-none bg-transparent text-sm text-ink-soft text-right pr-6 py-2 min-h-11 outline-none focus-visible:ring-2 focus-visible:ring-leaf rounded-lg cursor-pointer"
          >
            <option value="nvidia">NVIDIA (free default)</option>
            <option value="openrouter">OpenRouter (your key)</option>
          </select>
          <ChevronDown size={15} className="absolute right-0 text-ink-muted pointer-events-none" aria-hidden />
        </span>
      </label>

      <div className="px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={keyId} className="text-sm">
            API key
          </label>
          <span className="text-xs text-ink-muted">
            {ai.provider === "openrouter" ? "Required" : "Optional"}
          </span>
        </div>
        <div className="relative mt-2">
          <input
            id={keyId}
            type={showKey ? "text" : "password"}
            placeholder={KEY_PREFIX[ai.provider] + "…"}
            value={ai.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={keyStatus === "malformed" || keyStatus === "rejected" || undefined}
            aria-describedby={keyHelpId}
            className={cn(
              "bg-cream border rounded-xl pl-3 pr-12 py-2.5 min-h-11 text-sm font-mono w-full outline-none transition-colors",
              keyStatus === "valid"
                ? "border-leaf"
                : keyStatus === "malformed" || keyStatus === "rejected"
                  ? "border-ember"
                  : needsKey
                    ? "border-ember/60 focus:border-leaf"
                    : "border-ink/10 focus:border-leaf"
            )}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-0 top-1/2 -translate-y-1/2 size-11 inline-flex items-center justify-center rounded-xl text-ink-muted hover:text-ink transition-colors"
            aria-label={showKey ? "Hide API key" : "Show API key"}
            aria-pressed={showKey}
          >
            {showKey ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        </div>
        <p
          id={keyHelpId}
          aria-live="polite"
          className={cn(
            "flex items-start gap-1.5 text-xs leading-relaxed mt-2",
            keyMessage.tone === "bad" ? "text-ember-text" : keyMessage.tone === "good" ? "text-leaf-text" : "text-ink-muted"
          )}
        >
          {keyStatus === "checking" && <Loader2 size={12} className="animate-spin mt-0.5 shrink-0" aria-hidden />}
          {keyStatus === "valid" && <Check size={12} className="mt-0.5 shrink-0" aria-hidden />}
          <span>{keyMessage.text}</span>
        </p>
        {needsKey && (
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={() => update({ provider: "nvidia", model: "" })}
              className="inline-flex items-center min-h-11 px-4 rounded-full border border-ink/10 text-sm text-ink-soft hover:text-ink"
            >
              Use NVIDIA instead
            </button>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full text-sm text-leaf-text hover:bg-cream-deep/60"
            >
              Get an OpenRouter key <ExternalLink size={13} aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        )}
      </div>

      <div className="px-4 py-3">
        <span id={modelLabelId} className="block text-sm">
          Model
        </span>
        {pickerBlocked ? (
          <p className="mt-2 text-sm text-ink-muted leading-relaxed">
            {needsKey
              ? "Add an OpenRouter key to choose a model."
              : `Fix the API key to load ${providerName} models.`}
          </p>
        ) : (
          <>
            <ModelCombobox
              labelledBy={modelLabelId}
              models={models}
              value={ai.model}
              defaultLabel={defaultLabel}
              onChange={(model) => update({ model })}
              isLoading={loadingModels}
            />
            {modelsError && (
              <p className="text-xs text-ink-muted leading-relaxed mt-2">
                {modelsError} The default model still works.
              </p>
            )}
          </>
        )}
      </div>
    </Group>
  );
}

function ModelCombobox({
  labelledBy,
  models,
  value,
  defaultLabel,
  onChange,
  isLoading
}: {
  labelledBy: string;
  models: ModelInfo[];
  value: string;
  defaultLabel: string;
  onChange: (val: string) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const currentId = useId();

  const q = query.toLowerCase();
  const filtered = models.filter(
    (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
  );
  const selected = models.find((m) => m.id === value);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div
      className="relative mt-2"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${labelledBy} ${currentId}`}
        className="flex w-full min-h-11 items-center gap-2 bg-cream border border-ink/10 rounded-xl px-3 py-2.5 text-sm hover:border-leaf transition-colors text-left"
      >
        <span id={currentId} className="flex-1 truncate">
          {isLoading ? "Loading models…" : selected ? selected.name : value || defaultLabel}
        </span>
        <ChevronDown size={15} className="text-ink-muted shrink-0" aria-hidden />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="Choose a model"
            className="absolute top-full mt-1 left-0 right-0 z-50 bg-cream border border-ink/10 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-80"
          >
            <div className="p-2 border-b border-ink/10 bg-cream-warm">
              <div className="flex items-center gap-2 bg-cream border border-ink/10 rounded-lg px-2 min-h-11 focus-within:border-leaf transition-colors">
                <Search size={14} className="text-ink-muted shrink-0" aria-hidden />
                <input
                  autoFocus
                  type="search"
                  aria-label="Search models"
                  className="bg-transparent border-none outline-none text-sm flex-1 min-w-0 py-2"
                  placeholder="Search models…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-1">
              {!query && (
                <OptionRow active={!value} onClick={() => choose("")} name={defaultLabel} />
              )}
              {filtered.map((m) => {
                const isFree =
                  parseFloat(m.pricing?.prompt ?? "") === 0 && parseFloat(m.pricing?.completion ?? "") === 0;
                return (
                  <OptionRow
                    key={m.id}
                    active={value === m.id}
                    onClick={() => choose(m.id)}
                    name={m.name}
                    id={m.id}
                    price={isFree ? "free" : "paid"}
                  />
                );
              })}
              {isLoading && (
                <p className="p-4 text-center text-sm text-ink-muted" role="status">
                  Loading models…
                </p>
              )}
              {!isLoading && filtered.length === 0 && (
                <p className="p-4 text-center text-sm text-ink-muted">
                  {query ? "No models match that search." : "No other models to show."}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function OptionRow({
  active,
  onClick,
  name,
  id,
  price
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  id?: string;
  price?: "free" | "paid";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "w-full text-left flex flex-col gap-1 p-2.5 min-h-11 rounded-lg transition-colors",
        active ? "bg-leaf-pale" : "hover:bg-cream-warm"
      )}
    >
      <span className="flex items-center justify-between gap-2 w-full">
        <span className="font-medium text-sm truncate flex-1">{name}</span>
        {price && (
          <span className={cn("mono !text-xs shrink-0", price === "free" ? "text-leaf-text" : "text-ink-muted")}>
            {price}
          </span>
        )}
      </span>
      {id && <span className="font-mono text-xs text-ink-muted truncate w-full">{id}</span>}
    </button>
  );
}
