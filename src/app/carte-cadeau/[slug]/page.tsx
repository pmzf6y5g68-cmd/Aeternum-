import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Gift, Mail, ShieldCheck } from "lucide-react";
import { BusinessAvatar } from "@/components/business-avatar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCategory } from "@/config/categories";
import { GIFT_AMOUNTS } from "@/lib/gift-cards";
import { loadPublicBusiness } from "@/lib/marketplace";
import { businessPath } from "@/lib/slug";
import { GiftForm } from "./gift-form";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const biz = await loadPublicBusiness(slug).catch(() => null);
  if (!biz) return {};
  return {
    title: `Carte cadeau ${biz.name}${biz.city ? ` à ${biz.city}` : ""}`,
    description: `Offrez un moment chez ${biz.name} : carte cadeau en ligne, envoyée par email en quelques secondes, valable 1 an.`,
    alternates: { canonical: `/carte-cadeau/${biz.slug}` },
  };
}

export default async function GiftCardPage({ params }: { params: Params }) {
  const { slug } = await params;
  const biz = await loadPublicBusiness(slug);
  if (!biz || !biz.gift_cards_enabled || !biz.stripe_connect_onboarded) notFound();
  const cat = getCategory(biz.category);

  return (
    <>
      <SiteHeader variant="white" />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="card p-6 md:p-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">
            <Gift className="size-4" aria-hidden /> Carte cadeau
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">Offrez un moment chez {biz.name}</h1>
          <p className="mb-6 mt-2 text-ink-soft">Envoyée par email en quelques secondes. Le bénéficiaire réserve quand il le souhaite.</p>
          <GiftForm slug={biz.slug} amounts={GIFT_AMOUNTS} businessName={biz.name} />
        </section>
        <aside className="space-y-4">
          <Link href={businessPath(biz)} className="card flex items-center gap-3 p-4 hover:border-brand">
            <BusinessAvatar name={biz.name} category={biz.category} coverUrl={biz.cover_url} />
            <span className="min-w-0">
              <span className="block truncate font-bold">{biz.name}</span>
              <span className="text-sm text-ink-soft">
                {cat?.label}
                {biz.city ? ` · ${biz.city}` : ""}
              </span>
            </span>
          </Link>
          <ul className="card space-y-3 p-4 text-sm">
            <li className="flex gap-2">
              <Mail className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> Envoi immédiat par email, ou à imprimer.
            </li>
            <li className="flex gap-2">
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> Valable 1 an, sur toutes les prestations.
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> Paiement sécurisé, versé directement à l&apos;établissement.
            </li>
          </ul>
        </aside>
      </main>
      <SiteFooter />
    </>
  );
}
