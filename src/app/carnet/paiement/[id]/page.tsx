import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Lock, Ticket } from "lucide-react";
import { Logo } from "@/components/logo";
import { StatusCard } from "@/components/status-card";
import { eurToCents, formatEur } from "@/lib/domain/pricing";
import type { ClientPack } from "@/lib/packs";
import { businessPath } from "@/lib/slug";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { DepositCheckout } from "../../../paiement/[token]/embedded-checkout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Paiement du carnet", robots: { index: false } };

export default async function PackPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return <StatusCard tone="neutral" title="Lien invalide." />;
  const admin = createAdminClient();
  const { data: cp } = await admin.from("client_packs").select("*").eq("id", id).maybeSingle<ClientPack>();
  if (!cp) return <StatusCard tone="neutral" title="Lien invalide." />;
  const { data: biz } = await admin
    .from("businesses")
    .select("name, slug, category, city_slug, stripe_connect_account_id")
    .eq("id", cp.business_id)
    .single<{ name: string; slug: string; category: string; city_slug: string | null; stripe_connect_account_id: string | null }>();
  if (!biz?.stripe_connect_account_id || !cp.stripe_checkout_session_id) return <StatusCard tone="warning" title="Paiement indisponible pour le moment." />;

  const session = await getStripe().checkout.sessions.retrieve(cp.stripe_checkout_session_id, {}, { stripeAccount: biz.stripe_connect_account_id }).catch(() => null);
  const price = formatEur(eurToCents(cp.price_eur));
  if (cp.status === "active" || session?.payment_status === "paid") {
    return (
      <StatusCard tone="success" title="Votre carnet est actif">
        <p>
          Merci {cp.buyer_name} ! {cp.sessions_total} séances chez {biz.name}. Votre code vient de partir à {cp.buyer_email} : saisissez-le à chaque réservation.
        </p>
        <Link href={`${businessPath(biz)}#reserver`} className="btn-primary w-full">
          Réserver ma première séance
        </Link>
      </StatusCard>
    );
  }
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  if (!session || session.status !== "open" || !session.client_secret || !publishableKey) {
    return (
      <StatusCard tone="warning" title="Le paiement n'a pas abouti">
        <Link href={`/carnet/${biz.slug}`} className="btn-primary w-full">
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
              <Ticket className="size-4" aria-hidden /> {cp.name}
            </p>
            <p className="mt-2 text-3xl font-bold">{price}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {cp.sessions_total} séances chez {biz.name}, soit {formatEur(Math.round(eurToCents(cp.price_eur) / cp.sessions_total))} la séance.
            </p>
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
