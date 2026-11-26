import Link from "next/link";
import { CalendarSync, CheckCircle2, ChevronLeft, ChevronRight, House, Mail, MapPin, MessageSquareText, Monitor, PartyPopper, Phone, UserRound } from "lucide-react";
import { siteConfig } from "@/config/site";
import { fr } from "@/i18n/fr";
import type { BookingStatus } from "@/lib/domain/availability";
import { eurToCents, formatEur } from "@/lib/domain/pricing";
import { addDays, dayOfWeek, isValidDateString, zonedDateString, zonedTimeString, zonedTimeToUtc } from "@/lib/domain/time";
import { publicBusinessUrl, requireBusiness } from "@/lib/pro";
import type { Addon, Booking, Staff } from "@/lib/supabase/types";
import { CopyButton } from "@/components/copy-button";
import { reassignBooking, rotateCalendarToken, updateBookingStatus } from "../actions";

const t = fr.dashboard.agenda;
const TZ = siteConfig.booking.timeZone;

const badge: Record<BookingStatus, string> = {
  pending_deposit: "bg-amber-50 text-amber-700 ring-amber-200",
  scheduled: "bg-brand-soft text-brand ring-brand/20",
  confirmed: "bg-green-50 text-success ring-green-200",
  at_risk: "bg-red-50 text-danger ring-red-200",
  completed: "bg-canvas text-ink-soft ring-slate-200",
  cancelled: "bg-canvas text-slate-400 ring-slate-200 line-through",
  no_show: "bg-red-50 text-danger ring-red-200",
};

function dayTitle(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00Z`));
}

function Action({ id, status, label, primary }: { id: string; status: string; label: string; primary?: boolean }) {
  return (
    <form action={updateBookingStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`${primary ? "btn-primary" : "btn-secondary"} px-3 py-1.5 text-sm`}>
        {label}
      </button>
    </form>
  );
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ vue?: string; date?: string; membre?: string; bienvenue?: string }> }) {
  const sp = await searchParams;
  const { supabase, business } = await requireBusiness();
  const view = sp.vue === "jour" ? "jour" : "semaine";
  const today = zonedDateString(new Date(), TZ);
  const anchor = sp.date && isValidDateString(sp.date) ? sp.date : today;
  const start = view === "jour" ? anchor : addDays(anchor, -((dayOfWeek(anchor) + 6) % 7));
  const span = view === "jour" ? 1 : 7;

  const [{ data: bookings }, { data: staff }, { data: addons }] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .eq("business_id", business.id)
      .gte("start_at", zonedTimeToUtc(start, "00:00", TZ).toISOString())
      .lt("start_at", zonedTimeToUtc(addDays(start, span), "00:00", TZ).toISOString())
      .order("start_at")
      .returns<Booking[]>(),
    supabase.from("staff").select("id, name, active").eq("business_id", business.id).order("sort").returns<Pick<Staff, "id" | "name" | "active">[]>(),
    supabase.from("addons").select("id, name").eq("business_id", business.id).returns<Pick<Addon, "id" | "name">[]>(),
  ]);

  const staffList = staff ?? [];
  const staffName = new Map(staffList.map((s) => [s.id, s.name]));
  const addonName = new Map((addons ?? []).map((a) => [a.id, a.name]));
  const member = sp.membre && staffName.has(sp.membre) ? sp.membre : null;
  const visible = (bookings ?? []).filter((b) => !member || b.staff_id === member);
  const active = visible.filter((b) => !["cancelled"].includes(b.status));
  const revenue = active.filter((b) => b.status !== "no_show").reduce((s, b) => s + eurToCents(b.total_price_eur), 0);
  const noShows = visible.filter((b) => b.status === "no_show").length;

  const byDay = new Map<string, Booking[]>();
  for (const b of visible) {
    const key = zonedDateString(new Date(b.start_at), TZ);
    byDay.set(key, [...(byDay.get(key) ?? []), b]);
  }
  const days = Array.from({ length: span }, (_, i) => addDays(start, i));
  const calendarUrl = `${siteConfig.url.replace(/\/$/, "")}/api/calendar/${business.calendar_token}.ics`;
  const href = (params: { date?: string; vue?: string; membre?: string | null }) => {
    const q = new URLSearchParams({ vue: params.vue ?? view, date: params.date ?? anchor });
    const m = params.membre === undefined ? member : params.membre;
    if (m) q.set("membre", m);
    return `/pro/agenda?${q}`;
  };

  return (
    <div className="space-y-5">
      {sp.bienvenue && (
        <div className="card flex items-start gap-3 border-brand/30 bg-brand-softer">
          <PartyPopper className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <p className="text-sm">
            Votre page est en ligne et visible dans la recherche :{" "}
            <a href={publicBusinessUrl(business)} target="_blank" rel="noreferrer" className="font-semibold text-brand underline">
              {publicBusinessUrl(business).replace(/^https?:\/\//, "")}
            </a>
            . Personnalisez vos prestations et partagez votre lien.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {staffList.length > 1 && (
            <div className="flex flex-wrap gap-1">
              <Link href={href({ membre: null })} className={member ? "chip" : "chip-active"}>
                {t.allStaff}
              </Link>
              {staffList.map((s) => (
                <Link key={s.id} href={href({ membre: s.id })} className={member === s.id ? "chip-active" : "chip"}>
                  {s.name}
                </Link>
              ))}
            </div>
          )}
          <div className="inline-flex rounded-lg border border-line bg-surface p-1">
            <Link href={href({ vue: "jour" })} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === "jour" ? "bg-brand text-white" : "text-ink-soft"}`}>
              {t.day}
            </Link>
            <Link href={href({ vue: "semaine" })} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === "semaine" ? "bg-brand text-white" : "text-ink-soft"}`}>
              {t.week}
            </Link>
          </div>
          <Link href={href({ date: addDays(start, -span) })} className="btn-secondary px-2.5" aria-label={fr.search.previous}>
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
          <Link href={href({ date: today })} className="btn-secondary px-3 text-sm">
            {t.today}
          </Link>
          <Link href={href({ date: addDays(start, span) })} className="btn-secondary px-2.5" aria-label={fr.search.nextPage}>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        {[
          { label: t.stats.count, value: String(active.length) },
          { label: t.stats.revenue, value: formatEur(revenue) },
          { label: t.stats.noShow, value: String(noShows) },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <dt className="text-xs font-semibold text-ink-soft">{s.label}</dt>
            <dd className="mt-1 text-2xl font-bold">{s.value}</dd>
          </div>
        ))}
      </dl>

      <details className="card p-0">
        <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold">
          <CalendarSync className="size-4 text-brand" aria-hidden /> Synchroniser avec Google Agenda, Apple Calendrier ou Outlook
        </summary>
        <div className="space-y-3 border-t border-line p-4 text-sm">
          <p className="text-ink-soft">
            Abonnez votre agenda personnel à ce lien privé : vos rendez-vous s&apos;y affichent et se mettent à jour automatiquement (toutes les 15 min à quelques heures selon
            l&apos;application). Google Agenda : « Autres agendas » › « + » › « À partir de l&apos;URL ». iPhone / Mac : ouvrez le lien webcal.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input readOnly value={`${calendarUrl}`} className="input text-xs" aria-label="Lien de synchronisation" />
            <CopyButton value={calendarUrl} />
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={calendarUrl.replace(/^https?:/, "webcal:")} className="btn-secondary px-3 py-1.5 text-sm">
              Ouvrir dans Apple Calendrier / Outlook
            </a>
            <form action={rotateCalendarToken}>
              <button type="submit" className="btn-ghost px-3 py-1.5 text-sm text-danger">
                Régénérer le lien (révoque l&apos;ancien)
              </button>
            </form>
          </div>
        </div>
      </details>

      {visible.length === 0 && <p className="card text-sm text-ink-soft">{t.empty}</p>}

      {days.map((day) => {
        const list = byDay.get(day) ?? [];
        if (!list.length) return null;
        return (
          <section key={day}>
            <h2 className={`mb-2 text-sm font-bold capitalize ${day === today ? "text-brand" : "text-ink-soft"}`}>{dayTitle(day)}</h2>
            <ul className="space-y-3">
              {list.map((b) => {
                const opts = b.addon_ids.map((id) => addonName.get(id)).filter(Boolean);
                const address = b.location_type === "at_home" ? b.client_address : b.location_type === "on_site" ? business.address : null;
                const isActive = !["cancelled", "completed", "no_show"].includes(b.status);
                const LocIcon = b.location_type === "at_home" ? House : b.location_type === "online" ? Monitor : MapPin;
                return (
                  <li key={b.id} className="card border-l-4 border-l-brand p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold">
                          {zonedTimeString(new Date(b.start_at), TZ)} – {zonedTimeString(new Date(b.end_at), TZ)} <span className="font-medium text-ink-soft">· {b.client_name}</span>
                        </p>
                        <p className="text-sm font-semibold text-ink">
                          {b.service_name}
                          {b.variant_label ? ` · ${b.variant_label}` : ""}
                          {b.seats > 1 ? ` · ${b.seats} places` : ""}
                          {opts.length ? ` + ${opts.join(", ")}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${badge[b.status]}`}>{fr.bookingStatus[b.status]}</span>
                        {b.deposit_paid && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-success ring-1 ring-green-200">
                            <CheckCircle2 className="size-3" aria-hidden /> {t.depositPaid}
                          </span>
                        )}
                      </div>
                    </div>
                    <dl className="mt-3 grid gap-1.5 text-sm text-ink-soft sm:grid-cols-2">
                      <div className="font-bold text-ink">{b.total_price_eur > 0 ? formatEur(eurToCents(b.total_price_eur)) : fr.common.free}</div>
                      {b.staff_id && (
                        <div className="flex items-center gap-1.5">
                          <UserRound className="size-3.5" aria-hidden /> {staffName.get(b.staff_id) ?? "—"}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <LocIcon className="size-3.5 shrink-0" aria-hidden /> {fr.modes[b.location_type]}
                        {address && (
                          <a className="ml-1 truncate text-brand underline" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">
                            {t.openMaps}
                          </a>
                        )}
                      </div>
                      {b.client_phone && (
                        <a href={`tel:${b.client_phone}`} className="flex items-center gap-1.5 text-brand">
                          <Phone className="size-3.5" aria-hidden /> {b.client_phone}
                        </a>
                      )}
                      <a href={`mailto:${b.client_email}`} className="flex items-center gap-1.5 truncate text-brand">
                        <Mail className="size-3.5" aria-hidden /> {b.client_email}
                      </a>
                      {b.client_notes && (
                        <p className="flex items-start gap-1.5 sm:col-span-2">
                          <MessageSquareText className="mt-0.5 size-3.5 shrink-0" aria-hidden /> « {b.client_notes} »
                        </p>
                      )}
                    </dl>
                    {isActive && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                        {b.status !== "confirmed" && b.status !== "pending_deposit" && <Action id={b.id} status="confirmed" label={t.actions.confirm} primary />}
                        <Action id={b.id} status="completed" label={t.actions.complete} />
                        <Action id={b.id} status="no_show" label={t.actions.noShow} />
                        <Action id={b.id} status="cancelled" label={t.actions.cancel} />
                        {staffList.length > 1 && (
                          <form action={reassignBooking} className="ml-auto flex items-center gap-1.5">
                            <input type="hidden" name="id" value={b.id} />
                            <select name="staff_id" defaultValue={b.staff_id ?? ""} className="input w-auto py-1.5 text-sm">
                              {staffList.filter((s) => s.active).map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <button type="submit" className="btn-ghost px-2 py-1.5 text-sm">
                              {fr.common.save}
                            </button>
                          </form>
                        )}
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
