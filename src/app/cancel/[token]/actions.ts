"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { addDays, zonedDateString } from "@/lib/domain/time";
import { cancelByClient, loadBookingByToken, rescheduleByClient } from "@/lib/booking-token";
import { createAdminClient } from "@/lib/supabase/admin";

const enc = encodeURIComponent;

export async function cancelBooking(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const found = await loadBookingByToken(token);
  if (found) await cancelByClient(found.booking, found.business);
  redirect(`/cancel/${enc(token)}`);
}

/** Déplacement : le serveur revérifie tout (délai, limite, créneau libre) dans la RPC atomique. */
export async function rescheduleBooking(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const startAt = z.iso.datetime({ offset: true }).safeParse(String(formData.get("start_at") ?? ""));
  const found = await loadBookingByToken(token);
  if (!found || !startAt.success) redirect(`/cancel/${enc(token)}`);
  const outcome = await rescheduleByClient(found.booking, found.business, startAt.data);
  redirect(outcome === "moved" ? `/cancel/${enc(token)}?deplace=1` : `/cancel/${enc(token)}/deplacer?erreur=${outcome}`);
}

/** « Prévenez-moi si un créneau plus tôt se libère » : liste d'attente d'aujourd'hui à la veille du RDV. */
export async function earlierSlotAlert(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const found = await loadBookingByToken(token);
  if (!found) redirect(`/cancel/${enc(token)}`);
  const { booking } = found;
  const tz = siteConfig.booking.timeZone;
  const today = zonedDateString(new Date(), tz);
  const dayBefore = addDays(zonedDateString(new Date(booking.start_at), tz), -1);
  const until = [dayBefore, addDays(today, 31)].sort()[0] as string;
  if (until >= today) {
    // Doublon (même jour, même prestation) ignoré par l'index unique : l'alerte existe déjà.
    await createAdminClient()
      .from("waitlist_entries")
      .insert({ business_id: booking.business_id, service_id: booking.service_id, user_id: booking.client_user_id, name: booking.client_name, email: booking.client_email, date_from: today, date_to: until });
  }
  redirect(`/cancel/${enc(token)}?alerte=1`);
}
