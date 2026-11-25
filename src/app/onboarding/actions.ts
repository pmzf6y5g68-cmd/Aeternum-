"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { DEFAULT_ADDONS, DEFAULT_HOURS, DEFAULT_SERVICES } from "@/lib/defaults";
import { geocodeAddress } from "@/lib/domain/geocode";
import { errorMessage, logEvent } from "@/lib/events";
import { slugify } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";

export interface OnboardingState {
  error?: "invalid" | "geocode" | "exists" | "server";
}

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  phone: z.string().trim().max(30).optional().default(""),
  address: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
  service_mode: z.enum(["workshop", "mobile", "both"]),
});

async function uniqueSlug(base: string): Promise<string> {
  const admin = createAdminClient();
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await admin.from("studios").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createStudio(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const input = parsed.data;

  const admin = createAdminClient();
  const existing = await admin.from("studios").select("id").eq("owner_id", user.id).maybeSingle();
  if (existing.data) redirect("/dashboard");

  const geo = await geocodeAddress(`${input.address}, ${input.city}`);
  if (!geo) return { error: "geocode" };

  try {
    const slug = await uniqueSlug(slugify(input.name));
    const { data: studio, error } = await admin
      .from("studios")
      .insert({
        owner_id: user.id,
        slug,
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        address: geo.label,
        city: geo.city ?? input.city,
        base_lat: geo.lat,
        base_lng: geo.lng,
        service_mode: input.service_mode,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !studio) throw new Error(error?.message ?? "insert studio");

    const seeds = await Promise.all([
      admin.from("services").insert(DEFAULT_SERVICES.map((s) => ({ ...s, studio_id: studio.id }))),
      admin.from("addons").insert(DEFAULT_ADDONS.map((a) => ({ ...a, studio_id: studio.id }))),
      admin.from("opening_hours").insert(DEFAULT_HOURS.map((h) => ({ ...h, studio_id: studio.id }))),
    ]);
    const seedError = seeds.find((r) => r.error)?.error;
    if (seedError) throw new Error(seedError.message);

    // Boucle commerciale : le prospect qui s'inscrit passe en "converted" et ses fils sont rattachés au studio.
    const emails = Array.from(new Set([input.email, (user.email ?? "").toLowerCase()].filter(Boolean)));
    await admin.from("prospects").update({ status: "converted", next_followup_at: null }).in("email", emails);
    await admin.from("email_threads").update({ studio_id: studio.id }).in("contact_email", emails);
  } catch (err) {
    await logEvent("onboarding", errorMessage(err), { user_id: user.id });
    return { error: "server" };
  }

  redirect("/dashboard?welcome=1");
}
