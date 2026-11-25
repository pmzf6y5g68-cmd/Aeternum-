import { z } from "zod";
import { buildCalendarFeed } from "@/lib/email/ics";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, Business } from "@/lib/supabase/types";

/**
 * Flux iCalendar privé de l'agenda pro : abonnement depuis Google Agenda, Apple Calendrier ou Outlook
 * (mise à jour automatique). Le jeton secret est régénérable depuis l'espace pro.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const raw = (await params).token.replace(/\.ics$/, "");
  if (!z.uuid().safeParse(raw).success) return new Response("Not found", { status: 404 });
  const admin = createAdminClient();
  const { data: business } = await admin.from("businesses").select("id, name, address").eq("calendar_token", raw).maybeSingle<Pick<Business, "id" | "name" | "address">>();
  if (!business) return new Response("Not found", { status: 404 });

  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const to = new Date(Date.now() + 180 * 86_400_000).toISOString();
  const [{ data: bookings }, { data: staff }] = await Promise.all([
    admin.from("bookings").select("*").eq("business_id", business.id).gte("start_at", from).lte("start_at", to).not("status", "in", "(cancelled,pending_deposit)").order("start_at").limit(5000).returns<Booking[]>(),
    admin.from("staff").select("id, name").eq("business_id", business.id).returns<{ id: string; name: string }[]>(),
  ]);
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.name]));

  const feed = buildCalendarFeed(
    `${business.name} — Rendez-vous`,
    (bookings ?? []).map((b) => ({
      uid: `${b.id}@rendez-vous`,
      start: new Date(b.start_at),
      end: new Date(b.end_at),
      summary: `${b.client_name} — ${b.service_name}${b.staff_id && staffName.get(b.staff_id) ? ` (${staffName.get(b.staff_id)})` : ""}${b.status === "no_show" ? " [absent]" : ""}`,
      description: [b.variant_label, b.client_phone, b.client_email, b.client_notes].filter(Boolean).join("\n"),
      location: b.location_type === "at_home" ? (b.client_address ?? "") : b.location_type === "online" ? "Visio" : (business.address ?? ""),
    })),
  );
  return new Response(feed, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" } });
}
