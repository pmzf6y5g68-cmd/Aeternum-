"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { cancelByClient } from "@/lib/booking-token";
import { BUSINESS_CONTACT_COLUMNS, type BusinessContact } from "@/lib/email/booking-emails";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";
import type { Booking } from "@/lib/supabase/types";

async function requireUser() {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect("/login?next=/compte");
  return { supabase, user };
}

export async function cancelMyBooking(formData: FormData): Promise<void> {
  const { user } = await requireUser();
  const id = z.uuid().parse(formData.get("id"));
  const admin = createAdminClient();
  const { data: booking } = await admin.from("bookings").select("*").eq("id", id).eq("client_user_id", user.id).maybeSingle<Booking>();
  if (booking) {
    const { data: business } = await admin.from("businesses").select(BUSINESS_CONTACT_COLUMNS).eq("id", booking.business_id).single<BusinessContact>();
    if (business) await cancelByClient(booking, business);
  }
  revalidatePath("/compte");
}

export interface ProfileState {
  saved?: boolean;
}

export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const { supabase, user } = await requireUser();
  const input = z
    .object({
      full_name: z.string().trim().max(80),
      phone: z.string().trim().max(30),
      default_address: z.string().trim().max(200),
    })
    .parse({ full_name: formData.get("full_name") ?? "", phone: formData.get("phone") ?? "", default_address: formData.get("default_address") ?? "" });
  await supabase.from("customer_profiles").upsert({
    user_id: user.id,
    full_name: input.full_name || null,
    phone: input.phone || null,
    default_address: input.default_address || null,
  });
  revalidatePath("/compte/profil");
  return { saved: true };
}
