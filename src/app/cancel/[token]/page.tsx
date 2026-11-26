import type { Metadata } from "next";
import { StatusCard } from "@/components/status-card";
import { SubmitButton } from "@/components/submit-button";
import { format } from "@/i18n";
import { fr } from "@/i18n/fr";
import Link from "next/link";
import { canClientCancel, canClientReschedule, loadBookingByToken } from "@/lib/booking-token";
import { formatDateTime } from "@/lib/email/booking-emails";
import { cancelBooking, earlierSlotAlert } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gérer mon rendez-vous", robots: { index: false } };

const t = fr.confirmPage;

/** L'annulation exige un clic (POST) : les scanners de liens des messageries ne peuvent pas annuler. */
export default async function CancelPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ deplace?: string; alerte?: string }> }) {
  const { token } = await params;
  const { deplace, alerte } = await searchParams;
  const found = await loadBookingByToken(token);
  if (!found) return <StatusCard tone="neutral" title={t.invalid} />;
  const { booking, business } = found;
  const check = canClientCancel(booking, business);

  if (check === "already") {
    return (
      <StatusCard tone="success" title={t.cancelledTitle}>
        <p>{t.cancelledText}</p>
        {booking.deposit_paid && <p>{t.depositNotice}</p>}
      </StatusCard>
    );
  }
  if (check === "past") return <StatusCard tone="neutral" title={t.tooLate} />;
  if (check === "too_late") {
    return (
      <StatusCard tone="warning" title={t.cancelTitle}>
        <p>{format(t.lateCancel, { hours: business.cancellation_hours })}</p>
        {business.phone && (
          <a href={`tel:${business.phone}`} className="btn-primary w-full">
            {business.phone}
          </a>
        )}
      </StatusCard>
    );
  }
  const canMove = canClientReschedule(booking, business) === "ok";
  const daysAway = (new Date(booking.start_at).getTime() - Date.now()) / 86_400_000;
  return (
    <StatusCard tone={deplace ? "success" : "neutral"} title={deplace ? "Rendez-vous déplacé" : "Votre rendez-vous"}>
      <p className="text-base text-ink">
        <strong>{booking.service_name}</strong>
        {booking.beneficiary_name ? ` pour ${booking.beneficiary_name}` : ""} chez {business.name}
        <br />
        <span className="capitalize">{formatDateTime(booking.start_at)}</span>
      </p>
      {deplace && <p>Un nouvel email de confirmation et l'invitation agenda vous ont été envoyés.</p>}
      {alerte && <p className="font-medium text-brand">C'est noté : nous vous écrirons dès qu'un créneau plus tôt se libère.</p>}
      <div className="grid gap-2 pt-2">
        {canMove && (
          <Link href={`/cancel/${encodeURIComponent(token)}/deplacer`} className="btn-primary w-full">
            Déplacer le rendez-vous
          </Link>
        )}
        {daysAway >= 2 && !alerte && (
          <form action={earlierSlotAlert}>
            <input type="hidden" name="token" value={token} />
            <SubmitButton className="btn-secondary w-full">Me prévenir si un créneau plus tôt se libère</SubmitButton>
          </form>
        )}
        <details className="pt-2 text-left">
          <summary className="cursor-pointer text-center text-sm font-medium text-danger">Annuler le rendez-vous</summary>
          <div className="mt-3 space-y-2">
            {booking.deposit_paid && <p>{t.depositNotice}</p>}
            <form action={cancelBooking}>
              <input type="hidden" name="token" value={token} />
              <SubmitButton className="btn-primary w-full bg-danger hover:bg-red-700">{t.cancelButton}</SubmitButton>
            </form>
          </div>
        </details>
      </div>
    </StatusCard>
  );
}
