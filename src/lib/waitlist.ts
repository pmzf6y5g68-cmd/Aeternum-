import "server-only";
import { siteConfig } from "@/config/site";
import { zonedDateString } from "@/lib/domain/time";
import { formatDateTime } from "@/lib/email/booking-emails";
import { layoutHtml, sendEmail } from "@/lib/email/send";
import { env } from "@/lib/env";
import { errorMessage, logEvent } from "@/lib/events";
import { businessPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, Business, WaitlistEntry } from "@/lib/supabase/types";

const MAX_NOTIFIED_PER_SLOT = 15;

/**
 * Un créneau vient de se libérer (annulation, acompte expiré) : on prévient les personnes en liste
 * d'attente sur cette date, une seule fois chacune. Premier arrivé, premier servi via le lien.
 */
export async function notifyWaitlistForSlot(booking: Pick<Booking, "business_id" | "service_id" | "start_at">): Promise<number> {
  if (new Date(booking.start_at) <= new Date()) return 0;
  const admin = createAdminClient();
  const date = zonedDateString(new Date(booking.start_at), siteConfig.booking.timeZone);
  try {
    const { data: business } = await admin
      .from("businesses")
      .select("id, name, slug, category, city_slug, email")
      .eq("id", booking.business_id)
      .maybeSingle<Pick<Business, "id" | "name" | "slug" | "category" | "city_slug" | "email">>();
    if (!business) return 0;
    let query = admin
      .from("waitlist_entries")
      .select("*")
      .eq("business_id", booking.business_id)
      .is("notified_at", null)
      .lte("date_from", date)
      .gte("date_to", date)
      .order("created_at")
      .limit(MAX_NOTIFIED_PER_SLOT);
    query = booking.service_id ? query.or(`service_id.is.null,service_id.eq.${booking.service_id}`) : query.is("service_id", null);
    const { data: entries } = await query.returns<WaitlistEntry[]>();
    let sent = 0;
    for (const e of entries ?? []) {
      const { data: claimed } = await admin.from("waitlist_entries").update({ notified_at: new Date().toISOString() }).eq("id", e.id).is("notified_at", null).select("id");
      if (!claimed?.length) continue;
      const url = `${env.appUrl()}${businessPath(business)}?date=${date}${e.service_id ? `&service=${e.service_id}` : ""}#reserver`;
      const p = [`Bonjour ${e.name},`, `Bonne nouvelle : un créneau vient de se libérer chez ${business.name} le ${formatDateTime(booking.start_at)}.`, "Les créneaux libérés partent vite : réservez-le maintenant si vous le souhaitez."];
      await sendEmail({
        to: e.email,
        replyTo: business.email,
        subject: `Un créneau s'est libéré chez ${business.name}`,
        text: [...p, url].join("\n\n"),
        html: layoutHtml("Un créneau s'est libéré", p, [{ label: "Réserver ce créneau", url }]),
      });
      sent++;
    }
    return sent;
  } catch (err) {
    await logEvent("waitlist.notify", errorMessage(err), { business_id: booking.business_id }, "warning");
    return 0;
  }
}
