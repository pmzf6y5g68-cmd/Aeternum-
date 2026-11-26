import type { Metadata } from "next";
import Link from "next/link";
import { StatusCard } from "@/components/status-card";
import { SubmitButton } from "@/components/submit-button";
import { siteConfig } from "@/config/site";
import { canClientReschedule, loadBookingByToken, MAX_RESCHEDULES } from "@/lib/booking-token";
import { zonedDateString } from "@/lib/domain/time";
import { formatDateTime } from "@/lib/email/booking-emails";
import { computeSlotWindow, loadPublicBusiness } from "@/lib/marketplace";
import { createAdminClient } from "@/lib/supabase/admin";
import { rescheduleBooking } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Déplacer mon rendez-vous", robots: { index: false } };

const ERRORS: Record<string, string> = {
  slot_taken: "Ce créneau vient d'être pris. Choisissez-en un autre ci-dessous.",
  too_many: `Ce rendez-vous a déjà été déplacé ${MAX_RESCHEDULES} fois : contactez l'établissement.`,
  too_late: "Il est trop tard pour déplacer ce rendez-vous en ligne : contactez l'établissement.",
  past: "Ce rendez-vous ne peut plus être déplacé.",
};

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

/** Déplacer en 2 gestes : choisir un créneau, confirmer. Même prestation, même durée, même membre de l'équipe. */
export default async function ReschedulePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ erreur?: string }> }) {
  const { token } = await params;
  const { erreur } = await searchParams;
  const found = await loadBookingByToken(token);
  if (!found) return <StatusCard tone="neutral" title="Ce lien n'est plus valide." />;
  const { booking, business: contact } = found;
  const check = canClientReschedule(booking, contact);
  const business = await loadPublicBusiness(contact.slug);
  if (check !== "ok" || !business) {
    return (
      <StatusCard tone="warning" title="Déplacement impossible en ligne">
        <p>{ERRORS[check === "ok" ? "past" : check] ?? ERRORS.past}</p>
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="btn-primary w-full">
            Appeler {contact.name}
          </a>
        )}
      </StatusCard>
    );
  }

  let capacity = 1;
  if (booking.service_id) {
    const { data } = await createAdminClient().from("services").select("capacity").eq("id", booking.service_id).maybeSingle<{ capacity: number }>();
    capacity = data?.capacity ?? 1;
  }
  const duration = Math.round((new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 60_000);
  const window = await computeSlotWindow({
    business,
    serviceId: booking.service_id ?? "",
    capacity,
    durationMinutes: duration,
    staffIds: booking.staff_id ? [booking.staff_id] : [],
    requestedStaffId: booking.staff_id,
    seats: booking.seats,
    startDate: zonedDateString(new Date(), siteConfig.booking.timeZone),
    days: 14,
  });
  const days = window.days.map((d) => ({ ...d, slots: d.slots.filter((s) => s.startAt !== new Date(booking.start_at).toISOString()) })).filter((d) => d.slots.length);

  return (
    <main className="min-h-dvh bg-canvas px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href={`/cancel/${encodeURIComponent(token)}`} className="text-sm font-medium text-brand">
          ← Retour à mon rendez-vous
        </Link>
        <h1 className="mt-3 text-2xl font-bold">Déplacer mon rendez-vous</h1>
        <p className="mt-1 text-ink-soft">
          {booking.service_name} chez {contact.name}, actuellement le <strong className="text-ink">{formatDateTime(booking.start_at)}</strong>. Choisissez un nouveau créneau : l'ancien est libéré automatiquement.
        </p>
        {erreur && ERRORS[erreur] && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">{ERRORS[erreur]}</p>}
        {days.length === 0 ? (
          <div className="card mt-6 p-6 text-center">
            <p className="font-semibold">Aucun autre créneau dans les 14 prochains jours.</p>
            {window.nextAvailable && <p className="mt-1 text-sm text-ink-soft">Prochaine disponibilité : {dayLabel(window.nextAvailable)}.</p>}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {days.map((d) => (
              <section key={d.date} className="card p-4">
                <h2 className="font-semibold capitalize">{dayLabel(d.date)}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {d.slots.map((s) => (
                    <form key={s.startAt} action={rescheduleBooking}>
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="start_at" value={s.startAt} />
                      <SubmitButton className="btn-secondary min-w-20 px-3 py-2 text-sm tabular-nums">{s.time}</SubmitButton>
                    </form>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        <p className="mt-6 text-xs text-ink-soft">Déplacement gratuit jusqu'à {contact.cancellation_hours} h avant le rendez-vous, {MAX_RESCHEDULES} fois maximum.</p>
      </div>
    </main>
  );
}
