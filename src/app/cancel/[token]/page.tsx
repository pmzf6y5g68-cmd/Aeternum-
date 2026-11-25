import type { Metadata } from "next";
import { StatusCard } from "@/components/status-card";
import { SubmitButton } from "@/components/submit-button";
import { format } from "@/i18n";
import { fr } from "@/i18n/fr";
import { loadBookingByToken } from "@/lib/booking-token";
import { formatDateTime } from "@/lib/email/booking-emails";
import { cancelBooking } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Annulation", robots: { index: false } };

const t = fr.confirmPage;

/**
 * L'annulation exige un clic sur un bouton (POST) : les scanners de liens des
 * messageries ne doivent pas pouvoir annuler un RDV en suivant le lien.
 */
export default async function CancelPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const [{ token }, { done }] = await Promise.all([params, searchParams]);
  const found = await loadBookingByToken(token);
  if (!found) return <StatusCard tone="neutral" title={t.invalid} />;
  const { booking, studio } = found;

  if (booking.status === "cancelled") {
    return (
      <StatusCard tone="success" title={t.cancelledTitle}>
        <p>{t.cancelledText}</p>
        {booking.deposit_paid && <p>{t.depositNotice}</p>}
      </StatusCard>
    );
  }
  if (done || ["completed", "no_show"].includes(booking.status) || new Date(booking.start_at) < new Date()) {
    return <StatusCard tone="neutral" title={t.tooLate} />;
  }

  return (
    <StatusCard tone="warning" title={t.cancelTitle}>
      <p>{format(t.cancelText, { studio: studio.name, date: formatDateTime(booking.start_at) })}</p>
      {booking.deposit_paid && <p>{t.depositNotice}</p>}
      <form action={cancelBooking} className="pt-2">
        <input type="hidden" name="token" value={token} />
        <SubmitButton className="btn-primary w-full bg-red-600 hover:bg-red-700">{t.cancelButton}</SubmitButton>
      </form>
    </StatusCard>
  );
}
