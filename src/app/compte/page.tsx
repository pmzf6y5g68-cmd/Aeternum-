import Link from "next/link";
import { CalendarPlus, MapPin, RotateCcw, Star, UserRound } from "lucide-react";
import { BusinessAvatar } from "@/components/business-avatar";
import { SubmitButton } from "@/components/submit-button";
import { getCategory } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { format } from "@/i18n";
import { fr } from "@/i18n/fr";
import { canClientCancel } from "@/lib/booking-token";
import { eurToCents, formatEur } from "@/lib/domain/pricing";
import { businessPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import type { Booking, Business } from "@/lib/supabase/types";
import { canReview } from "../avis/[token]/review-rules";
import { cancelMyBooking } from "./actions";

const t = fr.account;
type Biz = Pick<Business, "id" | "name" | "slug" | "category" | "city_slug" | "address" | "cover_url" | "phone" | "cancellation_hours" | "email">;

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-green-50 text-success",
  scheduled: "bg-brand-soft text-brand",
  pending_deposit: "bg-amber-50 text-amber-700",
  at_risk: "bg-amber-50 text-amber-700",
  completed: "bg-canvas text-ink-soft",
  cancelled: "bg-red-50 text-danger",
  no_show: "bg-red-50 text-danger",
};

function DateBlock({ iso }: { iso: string }) {
  const d = new Date(iso);
  const tz = siteConfig.booking.timeZone;
  return (
    <div className="w-16 shrink-0 rounded-lg bg-brand text-center text-white">
      <p className="pt-1.5 text-xs font-semibold uppercase">{new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: tz }).format(d)}</p>
      <p className="text-2xl font-bold leading-none">{new Intl.DateTimeFormat("fr-FR", { day: "numeric", timeZone: tz }).format(d)}</p>
      <p className="pb-1.5 text-xs">{new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(d)}</p>
    </div>
  );
}

export default async function MyAppointmentsPage() {
  const { supabase, user } = await getCurrentUser();
  if (!user) return null;
  const { data: bookings } = await supabase.from("bookings").select("*").eq("client_user_id", user.id).order("start_at", { ascending: true }).limit(200).returns<Booking[]>();
  const list = bookings ?? [];
  const ids = Array.from(new Set(list.map((b) => b.business_id)));
  const admin = createAdminClient();
  const [{ data: businesses }, { data: reviews }, { data: staff }] = await Promise.all([
    ids.length
      ? admin.from("businesses").select("id, name, slug, category, city_slug, address, cover_url, phone, cancellation_hours, email").in("id", ids).returns<Biz[]>()
      : Promise.resolve({ data: [] as Biz[] }),
    list.length ? admin.from("reviews").select("booking_id").in("booking_id", list.map((b) => b.id)).returns<{ booking_id: string }[]>() : Promise.resolve({ data: [] as { booking_id: string }[] }),
    ids.length ? admin.from("staff").select("id, name").in("business_id", ids).returns<{ id: string; name: string }[]>() : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const bizById = new Map((businesses ?? []).map((b) => [b.id, b]));
  const reviewed = new Set((reviews ?? []).map((r) => r.booking_id));
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.name]));
  const now = new Date();
  const upcoming = list.filter((b) => new Date(b.end_at) >= now && !["cancelled", "no_show", "completed"].includes(b.status));
  const past = list.filter((b) => !upcoming.includes(b)).reverse();

  const card = (b: Booking) => {
    const biz = bizById.get(b.business_id);
    if (!biz) return null;
    const path = businessPath(biz);
    const cancel = canClientCancel(b, biz, now);
    const isUpcoming = upcoming.includes(b);
    return (
      <li key={b.id} className="card flex gap-4 p-4">
        <DateBlock iso={b.start_at} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <BusinessAvatar name={biz.name} category={biz.category} coverUrl={biz.cover_url} size="sm" />
              <div>
                <Link href={path} className="font-bold text-brand hover:underline">
                  {biz.name}
                </Link>
                <p className="text-xs text-ink-soft">{getCategory(biz.category)?.label}</p>
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[b.status] ?? ""}`}>{fr.bookingStatus[b.status]}</span>
          </div>
          <p className="text-sm font-semibold">
            {b.service_name}
            {b.variant_label ? ` · ${b.variant_label}` : ""}
            {b.seats > 1 ? ` · ${b.seats} places` : ""}
            {b.total_price_eur > 0 ? ` · ${formatEur(eurToCents(b.total_price_eur))}` : ""}
          </p>
          {b.staff_id && staffName.get(b.staff_id) && (
            <p className="flex items-center gap-1.5 text-sm text-ink-soft">
              <UserRound className="size-3.5" aria-hidden /> {staffName.get(b.staff_id)}
            </p>
          )}
          <p className="flex items-start gap-1.5 text-sm text-ink-soft">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {b.location_type === "online" ? fr.modes.online : b.location_type === "at_home" ? b.client_address : biz.address}
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {isUpcoming && (
              <a href={`/api/ics/${b.confirm_token}`} className="btn-secondary px-3 py-1.5 text-sm">
                <CalendarPlus className="size-4" aria-hidden /> {t.addToCalendar}
              </a>
            )}
            <Link href={b.service_id ? `${path}?service=${b.service_id}#reserver` : `${path}#reserver`} className="btn-secondary px-3 py-1.5 text-sm">
              <RotateCcw className="size-4" aria-hidden /> {t.rebook}
            </Link>
            {!isUpcoming && canReview(b, now) &&
              (reviewed.has(b.id) ? (
                <span className="inline-flex items-center gap-1 px-2 text-sm text-success">
                  <Star className="size-4 fill-current" aria-hidden /> {t.reviewed}
                </span>
              ) : (
                <Link href={`/avis/${b.confirm_token}`} className="btn-primary px-3 py-1.5 text-sm">
                  <Star className="size-4" aria-hidden /> {t.review}
                </Link>
              ))}
            {isUpcoming && cancel === "ok" && b.status !== "pending_deposit" && (
              <Link href={`/cancel/${b.confirm_token}/deplacer`} className="btn-secondary px-3 py-1.5 text-sm">
                Déplacer
              </Link>
            )}
            {isUpcoming && cancel === "ok" && (
              <details className="group">
                <summary className="btn-ghost cursor-pointer list-none px-3 py-1.5 text-sm text-danger">{t.cancel}</summary>
                <form action={cancelMyBooking} className="mt-2">
                  <input type="hidden" name="id" value={b.id} />
                  <SubmitButton className="btn-primary bg-danger px-3 py-1.5 text-sm hover:bg-red-700">{t.cancelConfirm}</SubmitButton>
                </form>
              </details>
            )}
          </div>
          {isUpcoming && cancel === "too_late" && <p className="text-xs text-ink-soft">{format(t.cancelTooLate, { hours: biz.cancellation_hours })}</p>}
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-bold">{t.upcoming}</h2>
        {upcoming.length ? (
          <ul className="space-y-3">{upcoming.map(card)}</ul>
        ) : (
          <div className="card text-center">
            <p className="text-ink-soft">{t.noUpcoming}</p>
            <Link href="/" className="btn-primary mt-3">
              {t.findPro}
            </Link>
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">{t.past}</h2>
        {past.length ? <ul className="space-y-3">{past.map(card)}</ul> : <p className="text-sm text-ink-soft">{t.noPast}</p>}
      </section>
    </div>
  );
}
