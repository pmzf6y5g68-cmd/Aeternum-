import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, RotateCcw, ShieldCheck, Ticket } from "lucide-react";
import { BusinessAvatar } from "@/components/business-avatar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCategory } from "@/config/categories";
import { eurToCents, formatEur, startingPriceCents } from "@/lib/domain/pricing";
import { loadCatalog, loadPublicBusiness } from "@/lib/marketplace";
import { perSessionCents, type Pack } from "@/lib/packs";
import { businessPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";
import { PackForm, type PackOption } from "./pack-form";

export const dynamic = "force-dynamic";
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const biz = await loadPublicBusiness(slug).catch(() => null);
  if (!biz) return {};
  return {
    title: `Carnets de séances ${biz.name}${biz.city ? ` à ${biz.city}` : ""}`,
    description: `Payez moins cher chaque séance chez ${biz.name} avec un carnet : code envoyé par email, séances déduites automatiquement à chaque réservation.`,
    alternates: { canonical: `/carnet/${biz.slug}` },
  };
}

export default async function PacksPage({ params, searchParams }: { params: Params; searchParams: Promise<{ carnet?: string }> }) {
  const { slug } = await params;
  const { carnet } = await searchParams;
  const biz = await loadPublicBusiness(slug);
  if (!biz || !biz.stripe_connect_onboarded) notFound();
  const [{ data: packs }, catalog] = await Promise.all([
    createAdminClient().from("packs").select("*").eq("business_id", biz.id).eq("active", true).order("sessions").returns<Pack[]>(),
    loadCatalog(biz),
  ]);
  if (!packs?.length) notFound();
  const session = await createSessionClient();
  const { data: auth } = await session.auth.getUser();
  const services = new Map(catalog.services.map((s) => [s.id, s]));
  const options: PackOption[] = packs
    .filter((p) => services.has(p.service_id))
    .map((p) => {
      const service = services.get(p.service_id)!;
      const unit = startingPriceCents(service);
      const per = perSessionCents(p);
      const saved = unit * p.sessions - eurToCents(p.price_eur);
      return {
        id: p.id,
        name: p.name,
        sessions: p.sessions,
        priceLabel: formatEur(eurToCents(p.price_eur)),
        perSession: formatEur(per),
        saving: saved > 0 ? `${formatEur(saved)} d'économie` : null,
        validity: `valable ${Math.round(p.validity_days / 30)} mois`,
        service: service.name,
      };
    });
  if (!options.length) notFound();
  const cat = getCategory(biz.category);

  return (
    <>
      <SiteHeader variant="white" />
      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="card p-6 md:p-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">
            <Ticket className="size-4" aria-hidden /> Carnet de séances
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">Chaque séance moins chère chez {biz.name}</h1>
          <p className="mb-6 mt-2 text-ink-soft">Payez une fois, réservez quand vous voulez : la séance est déduite automatiquement.</p>
          <PackForm packs={options} initial={carnet ?? null} prefill={{ name: String(auth.user?.user_metadata?.full_name ?? ""), email: auth.user?.email ?? "" }} />
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
              <CalendarCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> Réservez en ligne avec votre code, séance par séance.
            </li>
            <li className="flex gap-2">
              <RotateCcw className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> Une annulation dans les délais vous rend la séance.
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
