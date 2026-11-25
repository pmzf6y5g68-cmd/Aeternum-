import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Clock, CreditCard, House, Info, MapPin, Monitor, Navigation, Phone, ShieldCheck, Store, UserRound } from "lucide-react";
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
import { businessPath } from "@/lib/slug";
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
  };
}

function hhmm(v: string | null): string {
  return v ? v.slice(0, 5).replace(":", "h") : "";
}

export default async function BusinessPage({ params, searchParams }: { params: Params; searchParams: Promise<{ date?: string; service?: string; reservation?: string }> }) {
  const [{ category, city, slug }, sp] = await Promise.all([params, searchParams]);
  const biz = await loadPublicBusiness(slug);
  if (!biz) notFound();
  const canonical = businessPath(biz);
  if (biz.category !== category || (biz.city_slug || "france") !== city) permanentRedirect(canonical);

  const cat = getCategory(biz.category);
  const [catalog, session] = await Promise.all([loadCatalog(biz), getCurrentUser().catch(() => ({ user: null, supabase: null }))]);
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: biz.name,
    address: biz.address,
    telephone: biz.phone ?? undefined,
    url: `${siteConfig.url}${canonical}`,
    geo: biz.lat !== null ? { "@type": "GeoCoordinates", latitude: biz.lat, longitude: biz.lng } : undefined,
    aggregateRating: biz.rating_count > 0 ? { "@type": "AggregateRating", ratingValue: Number(biz.rating_avg), reviewCount: biz.rating_count } : undefined,
  };

  return (
    <>
      <SiteHeader variant="white" search={{ defaultCategory: biz.category, defaultPlaceLabel: biz.city ?? "" }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

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
            </div>
          </div>
          <div className="flex gap-2">
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
                business={{ slug: biz.slug, path: canonical, name: biz.name, modes: biz.modes, address: biz.address, pricing: pricingOf(biz) }}
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
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
