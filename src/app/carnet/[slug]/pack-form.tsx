"use client";

import { useState } from "react";
import { Loader2, Ticket } from "lucide-react";

export interface PackOption {
  id: string;
  name: string;
  sessions: number;
  priceLabel: string;
  perSession: string;
  saving: string | null;
  validity: string;
  service: string;
}

const ERRORS: Record<string, string> = {
  rate_limited: "Trop de tentatives. Réessayez dans quelques minutes.",
  unavailable: "Ce carnet n'est plus proposé.",
  payment_unavailable: "Paiement indisponible pour le moment. Réessayez dans un instant.",
};

export function PackForm({ packs, initial, prefill }: { packs: PackOption[]; initial: string | null; prefill: { name: string; email: string } }) {
  const [chosen, setChosen] = useState<string>(initial && packs.some((p) => p.id === initial) ? initial : (packs[0]?.id ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack_id: chosen, buyer_name: fd.get("buyer_name"), buyer_email: fd.get("buyer_email") }),
      });
      const data = (await res.json()) as { payment_url?: string; error?: string };
      if (!res.ok || !data.payment_url) throw new Error(ERRORS[data.error ?? ""] ?? "Vérifiez les informations saisies.");
      window.location.href = data.payment_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="label">Choisissez votre carnet</legend>
        {packs.map((p) => (
          <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${chosen === p.id ? "border-brand bg-brand-softer" : "border-line hover:border-brand"}`}>
            <input type="radio" name="pack" value={p.id} checked={chosen === p.id} onChange={() => setChosen(p.id)} className="size-4 accent-[#1758E6]" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{p.name}</span>
              <span className="text-sm text-ink-soft">
                {p.sessions} × {p.service} · {p.perSession} la séance · {p.validity}
              </span>
            </span>
            <span className="text-right">
              <span className="block text-lg font-bold">{p.priceLabel}</span>
              {p.saving && <span className="text-xs font-bold text-success">{p.saving}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="buyer_name">Votre nom</label>
          <input id="buyer_name" name="buyer_name" required minLength={2} maxLength={80} autoComplete="name" defaultValue={prefill.name} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="buyer_email">Votre email</label>
          <input id="buyer_email" name="buyer_email" type="email" required autoComplete="email" defaultValue={prefill.email} className="input" />
        </div>
      </div>
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <button type="submit" disabled={busy || !chosen} className="btn-primary w-full py-3 text-base">
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Ticket className="size-5" aria-hidden />} Payer et recevoir mon code
      </button>
    </form>
  );
}
