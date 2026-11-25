import type { Metadata } from "next";
import { StatusCard } from "@/components/status-card";
import { format } from "@/i18n";
import { fr } from "@/i18n/fr";
import { loadBookingByToken } from "@/lib/booking-token";
import { formatDateTime } from "@/lib/email/booking-emails";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmation", robots: { index: false } };

const t = fr.confirmPage;

/**
 * Confirmation 1 clic depuis l'email de rappel. Idempotent et sans risque :
 * un passage d'antivirus sur le lien ne fait que confirmer la venue.
 */
export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await loadBookingByToken(token);
  if (!found) return <StatusCard tone="neutral" title={t.invalid} />;
  const { booking, studio } = found;

  if (["cancelled", "no_show", "completed"].includes(booking.status) || new Date(booking.end_at) < new Date()) {
    return <StatusCard tone="neutral" title={t.tooLate} />;
  }
  if (booking.status === "scheduled" || booking.status === "at_risk") {
    await createAdminClient().from("bookings").update({ status: "confirmed" }).eq("id", booking.id).in("status", ["scheduled", "at_risk"]);
  }
  if (booking.status === "pending_deposit") return <StatusCard tone="warning" title={t.invalid} />;

  return (
    <StatusCard tone="success" title={t.confirmedTitle}>
      <p>{format(t.confirmedText, { studio: studio.name, date: formatDateTime(booking.start_at) })}</p>
    </StatusCard>
  );
}
