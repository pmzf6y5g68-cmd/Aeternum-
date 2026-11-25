import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Gift, Lock } from "lucide-react";
import { Logo } from "@/components/logo";
import { StatusCard } from "@/components/status-card";
import { eurToCents, formatEur } from "@/lib/domain/pricing";
import type { GiftCard } from "@/lib/gift-cards";
import { businessPath } from "@/lib/slug";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { DepositCheckout } from "../../../paiement/[token]/embedded-checkout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Paiement de la carte cadeau", robots: { index: false } };

export default async function GiftPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return <StatusCard tone="neutral" title="Lien invalide." />;
  const admin = createAdminClient();
  const { data: card } = await admin.from("gift_cards").select("*").eq("id", id).maybeSingle<GiftCard>();
  if (!card) return <StatusCard tone="neutral" title="Lien invalide." />;
  const { data: biz } = await admin.from("businesses").select("name, slug, category, city_slug, stripe_connect_account_id").eq("id", card.business_id).single<{ name: string; slug: string; category: string; city_slug: string | null; stripe_connect_account_id: string | null }>();
  if (!biz?.stripe_connect_account_id || !card.stripe_checkout_session_id) return <StatusCard tone="warning" title="Paiement indisponible pour le moment." />;

  const session = await getStripe().checkout.sessions.retrieve(card.stripe_checkout_session_id, {}, { stripeAccount: biz.stripe_connect_account_id }).catch(() => null);
  const amount = formatEur(eurToCents(card.amount_eur));
  if (card.status === "active" || session?.payment_status === "paid") {
    return (
      <StatusCard tone="success" title="Carte cadeau envoyée">
        <p>
          {card.recipient_email ? `${card.recipient_name} vient de recevoir` : "Vous venez de recevoir par email"} la carte cadeau de {amount} chez {biz.name}. Merci {card.buyer_name} !
        </p>
        <Link href={businessPath(biz)} className="btn-primary w-full">
          Voir {biz.name}
        </Link>
      </StatusCard>
    );
  }
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  if (!session || session.status !== "open" || !session.client_secret || !publishableKey) {
    return (
      <StatusCard tone="warning" title="Le paiement n'a pas abouti">
        <Link href={`/carte-cadeau/${biz.slug}`} className="btn-primary w-full">
          Recommencer
        </Link>
      </StatusCard>
    );
  }
  return (
    <main className="min-h-dvh bg-canvas px-4 py-6">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4 md:order-2">
          <Logo />
          <section className="card">
            <p className="flex items-center gap-2 text-sm font-semibold text-brand">
              <Gift className="size-4" aria-hidden /> Carte cadeau {biz.name}
            </p>
            <p className="mt-2 text-3xl font-bold">{amount}</p>
            <p className="mt-1 text-sm text-ink-soft">Pour {card.recipient_name}, de la part de {card.buyer_name}. Valable 1 an.</p>
          </section>
        </div>
        <div className="md:order-1">
          <h1 className="mb-3 flex items-center gap-2 text-xl font-bold">
            <Lock className="size-5 text-brand" aria-hidden /> Paiement sécurisé
          </h1>
          <DepositCheckout clientSecret={session.client_secret} account={biz.stripe_connect_account_id} publishableKey={publishableKey} />
        </div>
      </div>
    </main>
  );
}
