import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Clock, CreditCard, Gift, House, Info, MapPin, Monitor, Navigation, Phone, ShieldCheck, Store, Ticket, UserRound } from "lucide-react";
import { Attribution } from "@/components/attribution";
import { BusinessAvatar } from "@/components/business-avatar";
import { FavoriteButton, ShareButton } from "@/components/favorite-button";
import { LocationMap } from "@/components/location-map";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StarRow, Stars } from "@/components/stars";
import { getCategory } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { format } from "@/i18n";
import { fr } from "@/i18n/fr";
import { formatDuration, formatEur, startingPriceCents } from "@/lib/domain/pricing";
import { isValidDateString, zonedDateString } from "@/lib/domain/time";
import { loadCatalog, loadPublicBusiness, pricingOf } from "@/lib/marketplace";
import { reviewPhotoUrl } from "@/lib/review-photos";
import { createAdminClient } from "@/lib/supabase/admin";
import { businessPath } from "@/lib/slug";
import { breadcrumbJsonLd, businessFaq, businessJsonLd, faqJsonLd, jsonLdScript } from "@/lib/seo";
import { trackBusinessView } from "@/lib/stats";
import { getCurrentUser } from "@/lib/supabase/server";
import type { CustomerProfile } from "@/lib/supabase/types";
import { BookingWidget } from "./booking-widget";

export const dynamic = "force-dynamic";

type Params = Promise<{ category: string; city: string; slug: string }>;
const b = fr.business;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const biz = await loadPublicBusiness(slug).catch(() => null);
  if (!biz) return {};
  const cat = getCategory(biz.category);
  return {
    title: `${biz.name} — ${cat?.label ?? ""} à ${biz.city ?? ""} : prendre rendez-vous`,
    description: biz.tagline ?? `Prenez rendez-vous en ligne avec ${biz.name}${biz.city ? ` à ${biz.city}` : ""} : prix, avis et disponibilités en temps réel.`,
    alternates: { canonical: businessPath(biz) },
    openGraph: {
      type: "website",
      title: `${biz.name} — ${cat?.label ?? ""} à ${biz.city ?? ""}`,
      description: biz.tagline ?? `Réservez en ligne avec ${biz.name} : prix, avis vérifiés et créneaux libres en temps réel.`,
      url: businessPath(biz),
    },
  };
}

function hhmm(v: string | null): string {
  return v ? v.slice(0, 5).replace(":", "h") : "";
}

export default async function BusinessPage({ params, searchParams }: { params: Params; searchParams: Promise<{ date?: string; service?: string; reservation?: string; via?: string }> }) {
  const [{ category, city, slug }, sp] = await Promise.all([params, searchParams]);
  const biz = await loadPublicBusiness(slug);
  if (!biz) notFound();
  const canonical = businessPath(biz);
  if (biz.category !== category || (biz.city_slug || "france") !== city) permanentRedirect(canonical);

  const cat = getCategory(biz.category);
  const [catalog, session, , packsRes] = await Promise.all([
    loadCatalog(biz),
    getCurrentUser().catch(() => ({ user: null, supabase: null })),
    trackBusinessView(biz.id),
    biz.stripe_connect_onboarded ? createAdminClient().from("packs").select("service_id").eq("business_id", biz.id).eq("active", true).returns<{ service_id: string }[]>() : Promise.resolve({ data: [] as { service_id: string }[] }),
  ]);
  const packServiceIds = [...new Set((packsRes.data ?? []).map((p) => p.service_id))];
  const user = session.user;
  let isFavorite = false;
  let profile: CustomerProfile | null = null;
  if (user && session.supabase) {
    const [fav, prof] = await Promise.all([
      session.supabase.from("favorites").select("business_id").eq("business_id", biz.id).maybeSingle(),
      session.supabase.from("customer_profiles").select("*").eq("user_id", user.id).maybeSingle<CustomerProfile>(),
    ]);
    isFavorite = Boolean(fav.data);
    profile = prof.data;
  }

  const weekOrder = [1, 2, 3, 4, 5, 6, 0];
  const hoursByDay = new Map(catalog.hours.map((h) => [h.day_of_week, h]));
  const todayDow = new Date().getDay();
  const faq = businessFaq(biz, catalog.services, catalog.hours);
  const jsonLd = [
    businessJsonLd(biz, catalog.services, catalog.hours, catalog.reviews),
    faqJsonLd(faq),
    breadcrumbJsonLd([
      { name: siteConfig.name, path: "/" },
      { name: cat?.plural ?? biz.category, path: `/${biz.category}` },
      ...(biz.city_slug ? [{ name: `${cat?.plural ?? ""} à ${biz.city}`, path: `/${biz.category}/${biz.city_slug}` }] : []),
      { name: biz.name, path: canonical },
    ]),
  ];


  return (
    <>
      <SiteHeader variant="white" search={{ defaultCategory: biz.category, defaultPlaceLabel: biz.city ?? "" }} />
      <Attribution slug={biz.slug} via={sp.via} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      <section className="bg-brand">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 md:flex-row md:items-center md:justify-between md:py-8">
          <div className="flex items-center gap-4">
            <BusinessAvatar name={biz.name} category={biz.category} coverUrl={biz.cover_url} size="lg" />
            <div className="text-white">
              <nav className="mb-1 text-xs text-white/75">
                <Link href={`/${biz.category}`} className="hover:underline">
                  {cat?.plural}
                </Link>
                {biz.city_slug && (
                  <>
                    {" › "}
                    <Link href={`/${biz.category}/${biz.city_slug}`} className="hover:underline">
                      {biz.city}
                    </Link>
                  </>
                )}
              </nav>
              <h1 className="text-2xl font-bold leading-tight md:text-3xl">{biz.name}</h1>
              <p className="mt-0.5 font-medium text-white/90">{cat?.label}</p>
              {biz.rating_count > 0 && (
                <p className="mt-1.5 inline-flex rounded-md bg-white px-2 py-0.5">
                  <Stars rating={Number(biz.rating_avg)} count={biz.rating_count} />
                </p>
              )}
              {offerText(biz) && (
                <p className="mt-1.5 ml-1.5 inline-flex rounded-md bg-amber-300 px-2 py-0.5 text-sm font-bold text-ink">{offerText(biz)}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {packServiceIds.length > 0 && (
              <Link href={`/carnet/${biz.slug}`} className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/25">
                <Ticket className="size-4" aria-hidden /> Carnets
              </Link>
            )}
            {biz.gift_cards_enabled && biz.stripe_connect_onboarded && (
              <Link href={`/carte-cadeau/${biz.slug}`} className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/25">
                <Gift className="size-4" aria-hidden /> Offrir
              </Link>
            )}
            <FavoriteButton businessId={biz.id} initial={isFavorite} loggedIn={Boolean(user)} path={canonical} />
            <ShareButton title={biz.name} />
          </div>
        </div>
      </section>

      {sp.reservation === "ok" && (
        <div className="mx-auto mt-4 max-w-6xl px-4">
          <p className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-success">
            {fr.booking.successTitle} {fr.booking.depositSuccessText}
          </p>
        </div>
      )}
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <aside id="reserver" className="scroll-mt-24 lg:order-2">
          <div className="sticky top-24 overflow-hidden rounded-xl border border-line bg-white shadow-(--shadow-card)">
            <h2 className="bg-brand-softer px-5 py-3.5 text-lg font-bold text-ink">{fr.booking.title}</h2>
            {catalog.services.length ? (
              <BookingWidget
                key={sp.service ?? "default"}
                business={{ slug: biz.slug, path: canonical, name: biz.name, modes: biz.modes, address: biz.address, pricing: pricingOf(biz), packServiceIds }}
                services={catalog.services}
                addons={catalog.addons}
                staff={catalog.staff}
                variantLabel={cat?.variantLabel ?? null}
                initialServiceId={sp.service ?? null}
                initialDate={sp.date && isValidDateString(sp.date) ? sp.date : null}
                today={zonedDateString(new Date())}
                prefill={{ name: profile?.full_name ?? "", email: user?.email ?? "", phone: profile?.phone ?? "", address: profile?.default_address ?? "" }}
                loggedIn={Boolean(user)}
              />
            ) : (
              <p className="p-5 text-sm text-ink-soft">{fr.booking.noSlotsAtAll}</p>
            )}
          </div>
        </aside>

        <div className="space-y-6 lg:order-1">
          {(biz.tagline || biz.description || biz.highlights.length > 0) && (
            <section className="card">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Info className="size-5 text-brand" aria-hidden /> {b.about}
              </h2>
              {biz.tagline && <p className="mt-2 font-semibold">{biz.tagline}</p>}
              {biz.description && <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-soft">{biz.description}</p>}
              {biz.highlights.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {biz.highlights.map((h) => (
                    <li key={h} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand">
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="card">
            <h2 className="text-lg font-bold">{b.services}</h2>
            <ul className="mt-3 divide-y divide-line">
              {catalog.services.map((s) => {
                const cents = startingPriceCents(s);
                return (
                  <li key={s.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{s.name}</p>
                      {s.description && <p className="text-sm text-ink-soft">{s.description}</p>}
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
                        <Clock className="size-3" aria-hidden /> {formatDuration(s.duration_minutes)}
                        {s.variants.length > 0 && ` · ${s.variants.length} options (${cat?.variantLabel?.toLowerCase() ?? "variantes"})`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-right font-bold">
                        {s.variants.length > 0 && <span className="block text-xs font-normal text-ink-soft">{fr.common.from}</span>}
                        {cents === 0 ? fr.common.free : formatEur(cents)}
                      </span>
                      <Link href={`?service=${s.id}#reserver`} scroll={false} className="btn-secondary px-3 py-1.5 text-sm">
                        {b.choose}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {catalog.staff.length > 1 && (
            <section className="card">
              <h2 className="text-lg font-bold">{b.team}</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {catalog.staff.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 rounded-lg bg-canvas p-3">
                    <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand">
                      <UserRound className="size-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-semibold">{s.name}</span>
                      {s.title && <span className="text-sm text-ink-soft">{s.title}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card">
            <h2 className="text-lg font-bold">{b.practical}</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                {biz.address && (
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      <MapPin className="size-4 text-brand" aria-hidden /> {b.address}
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">{biz.address}</p>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(biz.address)}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                      <Navigation className="size-3.5" aria-hidden /> {b.directions}
                    </a>
                  </div>
                )}
                <div>
                  <p className="font-semibold">{b.modes}</p>
                  <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                    {biz.modes.map((m) => {
                      const Icon = m === "on_site" ? Store : m === "at_home" ? House : Monitor;
                      return (
                        <li key={m} className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1">
                          <Icon className="size-3.5" aria-hidden /> {fr.modes[m]}
                          {m === "at_home" && ` (≤ ${Number(biz.max_radius_km)} km)`}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {biz.phone && (
                  <a href={`tel:${biz.phone}`} className="flex items-center gap-2 font-semibold text-brand">
                    <Phone className="size-4" aria-hidden /> {biz.phone}
                  </a>
                )}
                {biz.payment_methods.length > 0 && (
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      <CreditCard className="size-4 text-brand" aria-hidden /> {b.payment}
                    </p>
                    <p className="mt-1 text-sm text-ink-soft">{biz.payment_methods.join(", ")}</p>
                  </div>
                )}
                <p className="flex items-start gap-2 text-sm text-ink-soft">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {biz.cancellation_hours > 0 ? format(b.cancellation, { hours: biz.cancellation_hours }) : b.cancellationAnytime}
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    <Clock className="size-4 text-brand" aria-hidden /> {b.hours}
                  </p>
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      {weekOrder.map((d) => {
                        const h = hoursByDay.get(d);
                        return (
                          <tr key={d} className={d === todayDow ? "font-semibold text-ink" : "text-ink-soft"}>
                            <td className="py-0.5 pr-3">{b.days[d]}</td>
                            <td className="py-0.5 text-right">
                              {!h || h.is_closed || !h.open_time
                                ? b.closed
                                : h.break_start
                                  ? `${hhmm(h.open_time)} – ${hhmm(h.break_start)}, ${hhmm(h.break_end)} – ${hhmm(h.close_time)}`
                                  : `${hhmm(h.open_time)} – ${hhmm(h.close_time)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {biz.lat !== null && biz.lng !== null && <LocationMap lat={biz.lat} lng={biz.lng} label={biz.name} />}
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="flex items-center gap-3 text-lg font-bold">
              {b.reviews} {biz.rating_count > 0 && <Stars rating={Number(biz.rating_avg)} count={biz.rating_count} size="md" />}
            </h2>
            {catalog.reviews.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">{b.noReviews}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {catalog.reviews.map((r) => (
                  <li key={r.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{r.author_name}</span>
                      <span className="text-xs text-ink-soft">{new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(r.created_at))}</span>
                    </div>
                    <StarRow value={r.rating} />
                    {r.comment && <p className="mt-1 text-sm text-ink-soft">{r.comment}</p>}
                    {r.photos?.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {r.photos.map((ph) => (
                          <a key={ph} href={reviewPhotoUrl(ph)} target="_blank" rel="noopener noreferrer" className="block size-20 overflow-hidden rounded-lg border border-line">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={reviewPhotoUrl(ph)} alt={`Photo de ${r.author_name}`} loading="lazy" className="size-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    {r.reply && (
                      <p className="mt-2 rounded-lg bg-canvas p-3 text-sm">
                        <span className="font-semibold">{b.reply} : </span>
                        {r.reply}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="text-lg font-bold">Questions fréquentes</h2>
            <div className="mt-2 divide-y divide-line">
              {faq.map((f) => (
                <details key={f.question} className="group py-3">
                  <summary className="cursor-pointer list-none font-semibold marker:hidden group-open:text-brand">{f.question}</summary>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </main>
      {catalog.services.length > 0 && (
        <>
          <div aria-hidden className="h-[calc(5rem+env(safe-area-inset-bottom))] lg:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-xl items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{biz.name}</p>
                <p className="text-xs text-ink-soft tabular-nums">
                  {biz.min_price_eur !== null ? `dès ${formatEur(Math.round(Number(biz.min_price_eur) * 100))}` : fr.common.free}
                  {biz.rating_count > 0 ? ` · ${Number(biz.rating_avg).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ★ (${biz.rating_count})` : ""}
                </p>
              </div>
              <a href="#reserver" className="btn-primary shrink-0 px-5">
                Prendre rendez-vous
              </a>
            </div>
          </div>
        </>
      )}
      <SiteFooter />
    </>
  );
}

const DAY_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** « −20 % mar., mer. 14h–16h · −30 % dernière minute » : les offres en clair, sans astérisque. */
function offerText(b: { offpeak_percent: number; offpeak_days: number[]; offpeak_start: string | null; offpeak_end: string | null; lastminute_percent: number; lastminute_hours: number; loyalty_every: number; loyalty_percent: number }): string | null {
  const parts: string[] = [];
  if (b.offpeak_percent > 0 && b.offpeak_start && b.offpeak_end && b.offpeak_days.length) {
    const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => b.offpeak_days.includes(d)).map((d) => DAY_SHORT[d]).join(" ");
    parts.push(`−${b.offpeak_percent} % ${days} ${b.offpeak_start.slice(0, 5).replace(":", "h")}–${b.offpeak_end.slice(0, 5).replace(":", "h")}`);
  }
  if (b.lastminute_percent > 0) parts.push(`−${b.lastminute_percent} % à moins de ${b.lastminute_hours} h`);
  if (b.loyalty_every >= 2 && b.loyalty_percent > 0) parts.push(b.loyalty_percent >= 100 ? `${b.loyalty_every}e visite offerte` : `${b.loyalty_every}e visite −${b.loyalty_percent} %`);
  return parts.length ? parts.join(" · ") : null;
}
