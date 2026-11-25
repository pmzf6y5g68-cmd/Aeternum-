import type { Metadata } from "next";
import { StatusCard } from "@/components/status-card";
import { SubmitButton } from "@/components/submit-button";
import { format } from "@/i18n";
import { fr } from "@/i18n/fr";
import { canClientCancel, loadBookingByToken } from "@/lib/booking-token";
import { formatDateTime } from "@/lib/email/booking-emails";
import { cancelBooking } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Annulation", robots: { index: false } };

const t = fr.confirmPage;

/** L'annulation exige un clic (POST) : les scanners de liens des messageries ne peuvent pas annuler. */
export default async function CancelPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
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
  return (
    <StatusCard tone="warning" title={t.cancelTitle}>
      <p>{format(t.cancelText, { business: business.name, date: formatDateTime(booking.start_at) })}</p>
      {booking.deposit_paid && <p>{t.depositNotice}</p>}
      <form action={cancelBooking} className="pt-2">
        <input type="hidden" name="token" value={token} />
        <SubmitButton className="btn-primary w-full bg-danger hover:bg-red-700">{t.cancelButton}</SubmitButton>
      </form>
    </StatusCard>
  );
}
