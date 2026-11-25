"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { applyListingCopy } from "../actions";

interface Copy {
  tagline: string;
  description: string;
  highlights: string[];
}

const ERRORS: Record<string, string> = {
  rate_limited: "Limite de 10 rédactions par jour atteinte. Réessayez demain.",
  ai_unavailable: "La rédaction IA n'est pas encore activée sur la plateforme.",
};

export function AiWriter() {
  const [notes, setNotes] = useState("");
  const [copy, setCopy] = useState<Copy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  async function generate() {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/pro/listing-copy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes }) });
      const data = (await res.json()) as Copy & { error?: string };
      if (!res.ok || data.error) setError(ERRORS[data.error ?? ""] ?? "La rédaction a échoué, réessayez.");
      else setCopy({ tagline: data.tagline, description: data.description, highlights: data.highlights });
    } catch {
      setError("Connexion impossible, réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor="ai-notes">
          Ce qui vous rend unique (facultatif)
        </label>
        <textarea id="ai-notes" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex. 12 ans d'expérience, produits bio, parking devant le salon, on parle anglais…" className="input" />
        <p className="mt-1 text-xs text-ink-soft">L&apos;IA n&apos;utilise que vos informations : elle n&apos;invente ni prix, ni diplôme, ni avis.</p>
      </div>
      <button type="button" onClick={generate} disabled={loading} className="btn-primary">
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
        {copy ? "Proposer une autre version" : "Rédiger ma fiche avec l'IA"}
      </button>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      {copy && (
        <div className="space-y-3 rounded-xl border border-brand/30 bg-brand-softer p-4">
          <div>
            <label className="label">Accroche</label>
            <input value={copy.tagline} maxLength={140} onChange={(e) => setCopy({ ...copy, tagline: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Présentation</label>
            <textarea rows={8} value={copy.description} maxLength={3000} onChange={(e) => setCopy({ ...copy, description: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Points forts (un par ligne)</label>
            <textarea rows={3} value={copy.highlights.join("\n")} onChange={(e) => setCopy({ ...copy, highlights: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 8) })} className="input" />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await applyListingCopy(copy);
                if (r.ok) setSaved(true);
                else setError("Enregistrement impossible : vérifiez la longueur des textes.");
              })
            }
            className="btn-primary"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />} Publier sur ma page
          </button>
          {saved && <p className="text-sm font-semibold text-success">Publié. Google et Bing sont prévenus automatiquement.</p>}
        </div>
      )}
    </div>
  );
}
