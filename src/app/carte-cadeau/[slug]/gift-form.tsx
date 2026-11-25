"use client";

import { useState } from "react";
import { Gift, Loader2 } from "lucide-react";

const ERRORS: Record<string, string> = {
  rate_limited: "Trop de tentatives. Réessayez dans quelques minutes.",
  unavailable: "Les cartes cadeaux ne sont plus proposées par cet établissement.",
};

export function GiftForm({ slug, amounts, businessName }: { slug: string; amounts: readonly number[]; businessName: string }) {
  const [amount, setAmount] = useState<number>(amounts[1] ?? 50);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = custom ? Number(custom) : amount;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business: slug, amount_eur: value, ...Object.fromEntries(fd) }),
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
      <fieldset>
        <legend className="label">Montant</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {amounts.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAmount(a);
                setCustom("");
              }}
              className={`rounded-xl border px-3 py-3 text-base font-bold transition ${!custom && amount === a ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"}`}
            >
              {a} €
            </button>
          ))}
          <input value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="Autre" aria-label="Autre montant en euros" className="input text-center font-bold" />
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="recipient_name">Pour</label>
          <input id="recipient_name" name="recipient_name" required minLength={2} maxLength={80} placeholder="Prénom du bénéficiaire" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="recipient_email">Son email (facultatif)</label>
          <input id="recipient_email" name="recipient_email" type="email" placeholder="Sinon, vous la recevez pour l'imprimer" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="buyer_name">De la part de</label>
          <input id="buyer_name" name="buyer_name" required minLength={2} maxLength={80} autoComplete="name" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="buyer_email">Votre email</label>
          <input id="buyer_email" name="buyer_email" type="email" required autoComplete="email" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="message">Petit mot (facultatif)</label>
          <textarea id="message" name="message" rows={3} maxLength={500} placeholder="Joyeux anniversaire !" className="input" />
        </div>
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      <button type="submit" disabled={busy || !(value >= 10 && value <= 1000)} className="btn-primary w-full py-3.5 text-base">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Gift className="size-5" aria-hidden />} Offrir {value >= 10 ? `${value} €` : ""} chez {businessName}
      </button>
      <p className="text-center text-xs text-ink-soft">Valable 1 an. Paiement sécurisé par Stripe, versé directement à {businessName}.</p>
    </form>
  );
}
