"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Clock } from "lucide-react";

/** Paiement intégré (Stripe Embedded Checkout) sur le compte Connect de l'établissement. */
export function DepositCheckout({ clientSecret, account, publishableKey, holdUntil }: { clientSecret: string; account: string; publishableKey: string; holdUntil?: string }) {
  const stripePromise = useMemo(() => loadStripe(publishableKey, { stripeAccount: account, locale: "fr" }), [publishableKey, account]);
  const [left, setLeft] = useState(() => (holdUntil ? Math.max(0, new Date(holdUntil).getTime() - Date.now()) : 0));

  useEffect(() => {
    if (!holdUntil) return;
    const id = setInterval(() => setLeft(Math.max(0, new Date(holdUntil).getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [holdUntil]);

  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");

  return (
    <div className="space-y-3">
      {holdUntil && (
      <p className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${left > 0 ? "bg-brand-softer text-brand" : "bg-red-50 text-danger"}`}>
        <Clock className="size-4" aria-hidden />
        {left > 0 ? `Créneau réservé pour vous pendant ${mm}:${ss}` : "Le délai est écoulé : le créneau a peut-être été libéré."}
      </p>
      )}
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}
