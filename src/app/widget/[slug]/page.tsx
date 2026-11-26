import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Attribution } from "@/components/attribution";
import { getCategory } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { fr } from "@/i18n/fr";
import { isValidDateString, zonedDateString } from "@/lib/domain/time";
import { loadCatalog, loadPublicBusiness, pricingOf } from "@/lib/marketplace";
import { businessPath } from "@/lib/slug";
import { trackBusinessView } from "@/lib/stats";
import { BookingWidget } from "../../[category]/[city]/[slug]/booking-widget";

export const dynamic = "force-dynamic";

/** Le module intégré n'est pas une page à indexer : la fiche canonique reste sur Rendez-vous. */
export const metadata: Metadata = { robots: { index: false, follow: true } };

type Params = Promise<{ slug: string }>;

export default async function EmbeddedWidget({ params, searchParams }: { params: Params; searchParams: Promise<{ service?: string; date?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const biz = await loadPublicBusiness(slug);
  if (!biz) notFound();
  const [catalog] = await Promise.all([loadCatalog(biz), trackBusinessView(biz.id, true)]);
  const cat = getCategory(biz.category);
  const path = businessPath(biz);

  return (
    <main className="min-h-dvh bg-surface">
      <Attribution slug={biz.slug} via="pro" />
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="truncate font-bold">{biz.name}</p>
          <p className="truncate text-xs text-ink-soft">{fr.booking.title}</p>
        </div>
      </header>
      {catalog.services.length ? (
        <BookingWidget
          key={sp.service ?? "default"}
          business={{ slug: biz.slug, path, name: biz.name, modes: biz.modes, address: biz.address, pricing: pricingOf(biz) }}
          services={catalog.services}
          addons={catalog.addons}
          staff={catalog.staff}
          variantLabel={cat?.variantLabel ?? null}
          initialServiceId={sp.service ?? null}
          initialDate={sp.date && isValidDateString(sp.date) ? sp.date : null}
          today={zonedDateString(new Date())}
          prefill={{ name: "", email: "", phone: "", address: "" }}
          loggedIn={false}
          embedded
        />
      ) : (
        <p className="p-5 text-sm text-ink-soft">{fr.booking.noSlotsAtAll}</p>
      )}
      <footer className="px-4 pb-4 pt-2 text-center text-xs text-ink-soft sm:px-5">
        Réservation sécurisée par{" "}
        <Link href={path} target="_blank" className="font-semibold text-brand hover:underline">
          {siteConfig.name}
        </Link>
      </footer>
    </main>
  );
}
