import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { StatusCard } from "@/components/status-card";
import { siteConfig } from "@/config/site";
import { loadBookingByToken } from "@/lib/booking-token";
import { eurToCents, formatEur } from "@/lib/domain/pricing";
import { formatDateTime } from "@/lib/email/booking-emails";
import { businessPath } from "@/lib/slug";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { DepositCheckout } from "./embedded-checkout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Paiement sécurisé", robots: { index: false } };

export default async function PaymentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await loadBookingByToken(token);
  if (!found) return <StatusCard tone="neutral" title="Ce lien de paiement n'est plus valide." />;
  const { booking, business } = found;
  if (booking.deposit_paid || booking.status !== "pending_deposit") redirect(`/paiement/${token}/retour`);

  const { data: acct } = await createAdminClient().from("businesses").select("stripe_connect_account_id").eq("id", booking.business_id).single<{ stripe_connect_account_id: string | null }>();
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  if (!acct?.stripe_connect_account_id || !booking.stripe_checkout_session_id || !publishableKey) {
    return <StatusCard tone="warning" title="Paiement indisponible pour le moment." />;
  }
  const session = await getStripe().checkout.sessions.retrieve(booking.stripe_checkout_session_id, {}, { stripeAccount: acct.stripe_connect_account_id });
  if (session.status !== "open" || !session.client_secret) {
    return (
      <StatusCard tone="warning" title="Le délai de paiement est écoulé">
        <p>Le créneau a été libéré. Vous pouvez en choisir un nouveau.</p>
        <Link href={businessPath(business)} className="btn-primary w-full">
          Choisir un créneau
        </Link>
      </StatusCard>
    );
  }
  const holdUntil = new Date(new Date(booking.created_at).getTime() + siteConfig.booking.pendingDepositTtlMinutes * 60_000).toISOString();

  return (
    <main className="min-h-dvh bg-canvas px-4 py-6">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4 md:order-2">
          <Logo />
          <section className="card">
            <h1 className="text-lg font-bold">{business.name}</h1>
            <p className="mt-1 text-sm font-semibold capitalize text-brand">{formatDateTime(booking.start_at)}</p>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt>
                  {booking.service_name}
                  {booking.variant_label ? ` · ${booking.variant_label}` : ""}
                  {booking.seats > 1 ? ` × ${booking.seats}` : ""}
                </dt>
                <dd>{formatEur(eurToCents(booking.total_price_eur))}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold">
                <dt>Acompte à régler</dt>
                <dd>{formatEur(eurToCents(booking.deposit_amount_eur))}</dd>
              </div>
              <div className="flex justify-between gap-3 text-ink-soft">
                <dt>Reste à payer sur place</dt>
                <dd>{formatEur(eurToCents(booking.total_price_eur) - eurToCents(booking.deposit_amount_eur))}</dd>
              </div>
            </dl>
          </section>
          <p className="flex items-start gap-2 text-xs text-ink-soft">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            L&apos;acompte est versé directement à {business.name}. Paiement chiffré et traité par Stripe : nous ne voyons jamais votre carte.
          </p>
        </div>
        <div className="md:order-1">
          <h2 className="mb-3 flex items-center gap-2 text-xl font-bold">
            <Lock className="size-5 text-brand" aria-hidden /> Paiement sécurisé
          </h2>
          <DepositCheckout clientSecret={session.client_secret} account={acct.stripe_connect_account_id} publishableKey={publishableKey} holdUntil={holdUntil} />
        </div>
      </div>
    </main>
  );
}
