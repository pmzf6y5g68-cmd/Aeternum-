import type { Metadata } from "next";
import Link from "next/link";
import { StatusCard } from "@/components/status-card";
import { loadBookingByToken } from "@/lib/booking-token";
import { formatDateTime } from "@/lib/email/booking-emails";
import { businessPath } from "@/lib/slug";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Paiement", robots: { index: false } };

/** Retour après paiement : la confirmation définitive est faite par le webhook (source de vérité). */
export default async function PaymentReturnPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await loadBookingByToken(token);
  if (!found) return <StatusCard tone="neutral" title="Lien invalide." />;
  const { booking, business } = found;

  let paid = booking.deposit_paid;
  if (!paid && booking.stripe_checkout_session_id) {
    const { data: acct } = await createAdminClient().from("businesses").select("stripe_connect_account_id").eq("id", booking.business_id).single<{ stripe_connect_account_id: string | null }>();
    if (acct?.stripe_connect_account_id) {
      const session = await getStripe().checkout.sessions.retrieve(booking.stripe_checkout_session_id, {}, { stripeAccount: acct.stripe_connect_account_id }).catch(() => null);
      paid = session?.payment_status === "paid";
    }
  }

  if (paid) {
    return (
      <StatusCard tone="success" title="Rendez-vous confirmé !">
        <p className="font-semibold capitalize text-brand">{formatDateTime(booking.start_at)}</p>
        <p>
          Acompte reçu par {business.name}. Votre confirmation avec l&apos;invitation calendrier arrive par email.
        </p>
        <Link href="/compte" className="btn-primary w-full">
          Mes rendez-vous
        </Link>
      </StatusCard>
    );
  }
  return (
    <StatusCard tone="warning" title="Paiement non finalisé">
      <p>Le paiement n&apos;a pas abouti.</p>
      {booking.status === "pending_deposit" ? (
        <Link href={`/paiement/${token}`} className="btn-primary w-full">
          Réessayer
        </Link>
      ) : (
        <Link href={businessPath(business)} className="btn-primary w-full">
          Choisir un autre créneau
        </Link>
      )}
    </StatusCard>
  );
}
