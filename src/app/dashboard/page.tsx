import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, MapPin, Phone, Mail, PartyPopper } from "lucide-react";
import { siteConfig } from "@/config/site";
import { fr } from "@/i18n/fr";
import type { BookingStatus } from "@/lib/domain/availability";
import { eurToCents, formatEur } from "@/lib/domain/pricing";
import { addDays, dayOfWeek, isValidDateString, zonedDateString, zonedTimeString, zonedTimeToUtc } from "@/lib/domain/time";
import { requireStudio } from "@/lib/studio";
import type { Addon, Booking, Service } from "@/lib/supabase/types";
import { updateBookingStatus } from "./actions";

const t = fr.dashboard.agenda;
const TZ = siteConfig.booking.timeZone;

const badgeStyles: Record<BookingStatus, string> = {
  pending_deposit: "bg-amber-50 text-amber-700 ring-amber-200",
  scheduled: "bg-slate-100 text-slate-700 ring-slate-200",
  confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  at_risk: "bg-red-50 text-red-700 ring-red-200",
  completed: "bg-sky-50 text-sky-700 ring-sky-200",
  cancelled: "bg-slate-50 text-slate-400 ring-slate-200 line-through",
  no_show: "bg-red-50 text-red-700 ring-red-200",
};

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${className}`}>{children}</span>;
}

function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`));
}

function ActionButton({ id, status, label, tone = "secondary" }: { id: string; status: string; label: string; tone?: "primary" | "secondary" }) {
  return (
    <form action={updateBookingStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`${tone === "primary" ? "btn-primary" : "btn-secondary"} px-3 py-1.5 text-sm`}>
        {label}
      </button>
    </form>
  );
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; welcome?: string }> }) {
  const params = await searchParams;
  const { supabase, studio } = await requireStudio();

  const view = params.view === "day" ? "day" : "week";
  const today = zonedDateString(new Date(), TZ);
  const anchor = params.date && isValidDateString(params.date) ? params.date : today;
  const start = view === "day" ? anchor : addDays(anchor, -((dayOfWeek(anchor) + 6) % 7));
  const span = view === "day" ? 1 : 7;
  const days = Array.from({ length: span }, (_, i) => addDays(start, i));

  const [{ data: bookings }, { data: services }, { data: addons }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .eq("studio_id", studio.id)
      .gte("start_at", zonedTimeToUtc(start, "00:00", TZ).toISOString())
      .lt("start_at", zonedTimeToUtc(addDays(start, span), "00:00", TZ).toISOString())
      .order("start_at")
      .returns<Booking[]>(),
    supabase.from("services").select("id, name").eq("studio_id", studio.id).returns<Pick<Service, "id" | "name">[]>(),
    supabase.from("addons").select("id, name").eq("studio_id", studio.id).returns<Pick<Addon, "id" | "name">[]>(),
  ]);

  const serviceName = new Map((services ?? []).map((s) => [s.id, s.name]));
  const addonName = new Map((addons ?? []).map((a) => [a.id, a.name]));
  const byDay = new Map<string, Booking[]>();
  for (const b of bookings ?? []) {
    const key = zonedDateString(new Date(b.start_at), TZ);
    byDay.set(key, [...(byDay.get(key) ?? []), b]);
  }

  const prev = addDays(start, -span);
  const next = addDays(start, span);
  const href = (date: string, v: string = view) => `/dashboard?view=${v}&date=${date}`;

  return (
    <div className="space-y-5">
      {params.welcome && (
        <div className="card flex items-start gap-3 border-accent/30 bg-accent-soft/40">
          <PartyPopper className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <p className="text-sm">
            Votre page est en ligne :{" "}
            <Link href={`/${studio.slug}`} className="font-semibold text-accent underline" target="_blank">
              {siteConfig.url.replace(/^https?:\/\//, "")}/{studio.slug}
            </Link>
            . Partagez-la depuis l&apos;onglet « {fr.dashboard.nav.share} ».
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            <Link href={href(anchor, "day")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === "day" ? "bg-accent text-white" : "text-slate-600"}`}>
              {t.day}
            </Link>
            <Link href={href(anchor, "week")} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === "week" ? "bg-accent text-white" : "text-slate-600"}`}>
              {t.week}
            </Link>
          </div>
          <Link href={href(prev)} className="btn-secondary px-2.5" aria-label="Précédent">
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link href={href(today)} className="btn-secondary px-3 text-sm">
            {t.today}
          </Link>
          <Link href={href(next)} className="btn-secondary px-2.5" aria-label="Suivant">
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>

      {(bookings ?? []).length === 0 && <p className="card text-sm text-slate-500">{t.empty}</p>}

      {days.map((day) => {
        const list = byDay.get(day) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={day}>
            <h2 className={`mb-2 text-sm font-semibold capitalize ${day === today ? "text-accent" : "text-slate-500"}`}>{dayLabel(day)}</h2>
            <ul className="space-y-3">
              {list.map((b) => {
                const options = b.addon_ids.map((id) => addonName.get(id)).filter(Boolean);
                const address = b.location_type === "mobile" ? b.client_address : studio.address;
                const active = !["cancelled", "completed", "no_show"].includes(b.status);
                return (
                  <li key={b.id} className="card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">
                          {zonedTimeString(new Date(b.start_at), TZ)} – {zonedTimeString(new Date(b.end_at), TZ)}{" "}
                          <span className="font-normal text-slate-500">· {b.client_name}</span>
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          {serviceName.get(b.service_id ?? "") ?? "Prestation"} · {fr.vehicleSizes[b.vehicle_size]}
                          {b.vehicle_model ? ` (${b.vehicle_model})` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge className={badgeStyles[b.status]}>{fr.bookingStatus[b.status]}</Badge>
                        {b.deposit_paid && (
                          <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">
                            <CheckCircle2 className="mr-1 size-3" aria-hidden />
                            {t.depositPaid}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <dl className="mt-3 grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
                      {options.length > 0 && (
                        <div>
                          <dt className="inline font-medium text-slate-700">{t.options} : </dt>
                          <dd className="inline">{options.join(", ")}</dd>
                        </div>
                      )}
                      <div className="font-semibold text-ink">{formatEur(eurToCents(b.total_price_eur))}</div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" aria-hidden />
                        {b.location_type === "mobile" ? t.atHome : t.atWorkshop}
                        {address && (
                          <a className="ml-1 truncate text-accent underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">
                            {t.openMaps}
                          </a>
                        )}
                      </div>
                      {b.client_phone && (
                        <a href={`tel:${b.client_phone}`} className="flex items-center gap-1.5 text-accent">
                          <Phone className="size-3.5" aria-hidden /> {b.client_phone}
                        </a>
                      )}
                      <a href={`mailto:${b.client_email}`} className="flex items-center gap-1.5 truncate text-accent">
                        <Mail className="size-3.5" aria-hidden /> {b.client_email}
                      </a>
                    </dl>

                    {active && (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        {b.status !== "confirmed" && b.status !== "pending_deposit" && <ActionButton id={b.id} status="confirmed" label={t.actions.confirm} tone="primary" />}
                        <ActionButton id={b.id} status="completed" label={t.actions.complete} />
                        <ActionButton id={b.id} status="no_show" label={t.actions.noShow} />
                        <ActionButton id={b.id} status="cancelled" label={t.actions.cancel} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
