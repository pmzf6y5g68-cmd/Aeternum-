"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

/** Bouton qui POST vers une route API renvoyant { url } puis redirige (Stripe Checkout, Portal, Connect). */
export function PostRedirectButton({
  endpoint,
  label,
  className = "btn-primary",
  errorLabel = "Une erreur est survenue. Réessayez dans un instant.",
  body,
}: {
  body?: Record<string, unknown>;
  endpoint: string;
  label: string;
  className?: string;
  errorLabel?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? errorLabel);
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : errorLabel);
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={onClick} disabled={loading} className={className}>
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {label}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
