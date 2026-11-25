import { loadBookingByToken } from "@/lib/booking-token";
import { buildIcs } from "@/lib/email/ics";
import { env } from "@/lib/env";

/** Téléchargement .ics d'un rendez-vous (lien « Ajouter au calendrier »). */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await loadBookingByToken(token);
  if (!found) return new Response("Not found", { status: 404 });
  const { booking, business } = found;
  const ics = buildIcs({
    uid: `${booking.id}@rendez-vous`,
    start: new Date(booking.start_at),
    end: new Date(booking.end_at),
    summary: `${booking.service_name} — ${business.name}`,
    description: `Gérer : ${env.appUrl()}/compte`,
    location: booking.location_type === "at_home" ? (booking.client_address ?? "") : booking.location_type === "online" ? "Visio" : (business.address ?? ""),
    organizerName: business.name,
    organizerEmail: env.emailReplyTo(),
  });
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="rendez-vous.ics"', "Cache-Control": "no-store" },
  });
}
