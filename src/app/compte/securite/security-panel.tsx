"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

interface Factor {
  id: string;
  friendly_name?: string;
  status: string;
  created_at: string;
}

interface Enrollment {
  id: string;
  qr: string;
  secret: string;
}

export function SecurityPanel() {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [aal, setAal] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const supabase = createBrowserSupabase();
    const [{ data }, { data: level }] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
    setFactors((data?.totp ?? []).filter((f) => f.status === "verified"));
    setAal(level?.currentLevel ?? null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function startEnroll() {
    setBusy(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    // Nettoie une inscription précédente non terminée.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Application ${new Date().toLocaleDateString("fr-FR")}` });
    setBusy(false);
    if (error || !data) {
      setMessage({ tone: "error", text: "Activation impossible pour le moment. Réessayez dans quelques instants." });
      return;
    }
    setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    const { error } = await createBrowserSupabase().auth.mfa.challengeAndVerify({ factorId: enrollment.id, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (error) {
      setMessage({ tone: "error", text: "Code incorrect. Vérifiez l'heure de votre téléphone et saisissez le code actuel." });
      return;
    }
    setEnrollment(null);
    setCode("");
    setMessage({ tone: "ok", text: "Double authentification activée. Un code vous sera demandé à chaque nouvelle connexion." });
    refresh();
  }

  async function remove(id: string) {
    if (!confirm("Désactiver la double authentification sur ce compte ?")) return;
    setBusy(true);
    const { error } = await createBrowserSupabase().auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) setMessage({ tone: "error", text: "Pour la désactiver, reconnectez-vous et validez d'abord votre code de vérification." });
    else {
      setMessage({ tone: "ok", text: "Double authentification désactivée." });
      refresh();
    }
  }

  const active = (factors?.length ?? 0) > 0;

  return (
    <section className="card">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${active ? "bg-green-50 text-success" : "bg-brand-soft text-brand"}`}>
          <ShieldCheck className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">Double authentification</h2>
          <p className="text-sm text-ink-soft">
            {active
              ? "Activée : en plus de votre email, un code de votre application d'authentification est demandé à chaque nouvelle connexion."
              : "Protégez votre compte avec un code à 6 chiffres généré par votre téléphone, en plus de votre email. Fortement recommandé pour les professionnels."}
          </p>
        </div>
      </div>

      {factors === null && <Loader2 className="mt-4 size-5 animate-spin text-ink-soft" aria-hidden />}

      {active && (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {factors!.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Smartphone className="size-4 text-brand" aria-hidden /> {f.friendly_name ?? "Application d'authentification"}
              </span>
              <button type="button" onClick={() => remove(f.id)} disabled={busy} className="btn-ghost text-sm text-danger">
                <Trash2 className="size-4" aria-hidden /> Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      {factors !== null && !active && !enrollment && (
        <button type="button" onClick={startEnroll} disabled={busy} className="btn-primary mt-4">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />} Activer la double authentification
        </button>
      )}

      {enrollment && (
        <div className="mt-5 grid gap-5 rounded-xl border border-line bg-canvas p-4 sm:grid-cols-[180px_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qr} alt="QR code à scanner avec votre application d'authentification" width={180} height={180} className="rounded-lg bg-white p-2" />
          <form onSubmit={confirmEnroll} className="space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Ouvrez Google Authenticator, Microsoft Authenticator, 1Password ou l&apos;app Mots de passe d&apos;iOS.</li>
              <li>Scannez le QR code (ou saisissez la clé ci-dessous).</li>
              <li>Entrez le code à 6 chiffres affiché.</li>
            </ol>
            <code className="block break-all rounded bg-white px-2 py-1 text-xs">{enrollment.secret}</code>
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} required placeholder="123456" aria-label="Code de vérification" className="input text-center text-lg font-semibold tracking-[.3em]" />
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} Confirmer
            </button>
          </form>
        </div>
      )}

      {message && (
        <p className={`mt-4 flex items-center gap-2 text-sm font-semibold ${message.tone === "ok" ? "text-success" : "text-danger"}`}>
          {message.tone === "ok" && <CheckCircle2 className="size-4" aria-hidden />} {message.text}
        </p>
      )}
      {aal && <p className="mt-3 text-xs text-ink-soft">Niveau de la session actuelle : {aal === "aal2" ? "vérifiée en deux étapes" : "email uniquement"}.</p>}
    </section>
  );
}
