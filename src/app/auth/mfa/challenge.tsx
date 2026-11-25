"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function MfaChallenge({ next }: { next: string }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createBrowserSupabase()
      .auth.mfa.listFactors()
      .then(({ data }) => {
        const factor = data?.totp.find((f) => f.status === "verified");
        if (factor) setFactorId(factor.id);
        else window.location.replace(next);
      });
  }, [next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error: err } = await createBrowserSupabase().auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
    if (err) {
      setError("Code incorrect. Saisissez le code à 6 chiffres affiché actuellement dans votre application.");
      setBusy(false);
      return;
    }
    window.location.replace(next);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-3 rounded-xl bg-brand-soft p-4 text-sm text-brand-dark">
        <ShieldCheck className="size-5 shrink-0" aria-hidden />
        <p>Ouvrez votre application d&apos;authentification (Google Authenticator, Microsoft Authenticator, 1Password…) et saisissez le code de Rendez-vous.</p>
      </div>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        required
        autoFocus
        placeholder="123456"
        aria-label="Code de vérification"
        className="input text-center text-xl font-semibold tracking-[.4em]"
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={busy || !factorId} className="btn-primary w-full">
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Vérifier
      </button>
    </form>
  );
}
