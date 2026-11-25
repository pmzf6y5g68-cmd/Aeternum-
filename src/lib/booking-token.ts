import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, Studio } from "@/lib/supabase/types";

export type StudioContact = Pick<Studio, "name" | "email" | "phone" | "address" | "slug">;

export async function loadBookingByToken(token: string): Promise<{ booking: Booking; studio: StudioContact } | null> {
  if (!z.uuid().safeParse(token).success) return null;
  const admin = createAdminClient();
  const { data: booking } = await admin.from("bookings").select("*").eq("confirm_token", token).maybeSingle<Booking>();
  if (!booking) return null;
  const { data: studio } = await admin
    .from("studios")
    .select("name, email, phone, address, slug")
    .eq("id", booking.studio_id)
    .single<StudioContact>();
  return studio ? { booking, studio } : null;
}
