"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, LogOut, MapPin, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

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
        <h2 className="mono text-ink-muted text-xs mb-3">delivery address</h2>

        {addresses === null && (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 size={14} className="animate-spin" /> Loading your saved addresses…
          </p>
        )}

        {addresses?.length === 0 && (
          <p className="text-sm text-ink-soft leading-relaxed">
            No saved addresses on your Swiggy account. Add one in the Swiggy app —
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
                  <span className="mono text-ink-muted text-xs block mb-0.5">
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

      {/* Swiggy connection */}
      <section className="card-solid p-5">
        <h2 className="mono text-ink-muted text-xs mb-3">swiggy account</h2>
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
        <h2 className="mono text-ink-muted text-xs mb-3">account</h2>
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
        <h2 className="mono text-ember-text text-xs mb-3">delete my data</h2>
        <p className="text-sm text-ink-soft leading-relaxed mb-4">
          Permanently deletes your profile — condition, numbers, food preferences and
          saved address — and signs you out. Your Swiggy account and order history are
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
              className="inline-flex items-center gap-2 rounded-full bg-ember text-cream px-4 py-2 text-sm font-medium disabled:opacity-60"
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

      {error && <p className="text-sm text-ember-text">{error}</p>}
    </div>
  );
}
