"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LOCATION_MODES, getCategory, type LocationMode } from "@/config/categories";
import { buildSeedAddons, buildSeedHours, buildSeedServices } from "@/lib/catalog";
import { geocodeAddress } from "@/lib/domain/geocode";
import { errorMessage, logEvent } from "@/lib/events";
import { businessUrlsToPing, pingIndexNow } from "@/lib/indexnow";
import { businessSlug, slugify } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/server";

export interface OnboardingState {
  error?: "invalid" | "geocode" | "server";
}

const schema = z.object({
  category: z.string().refine((c) => getCategory(c) !== null),
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  phone: z.string().trim().max(30).optional().default(""),
  address: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
});

async function uniqueSlug(base: string): Promise<string> {
  const admin = createAdminClient();
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await admin.from("businesses").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createBusiness(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login?next=/pro/inscription");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const input = parsed.data;
  const category = getCategory(input.category)!;
  const chosenModes = formData.getAll("modes").filter((m): m is LocationMode => (LOCATION_MODES as string[]).includes(String(m)));
  const modes = chosenModes.length ? chosenModes : category.modes;

  const admin = createAdminClient();
  const existing = await admin.from("businesses").select("id").eq("owner_id", user.id).limit(1).maybeSingle();
  if (existing.data) redirect("/pro/agenda");

  const geo = await geocodeAddress(`${input.address}, ${input.city}`);
  if (!geo) return { error: "geocode" };

  try {
    const city = geo.city ?? input.city;
    const slug = await uniqueSlug(businessSlug(input.name, city));
    const { data: business, error } = await admin
      .from("businesses")
      .insert({
        owner_id: user.id,
        slug,
        name: input.name,
        category: category.slug,
        email: input.email,
        phone: input.phone || null,
        address: geo.label,
        city,
        city_slug: slugify(city),
        lat: geo.lat,
        lng: geo.lng,
        modes,
        payment_methods: ["Carte bancaire", "Espèces"],
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !business) throw new Error(error?.message ?? "insert business");

    // Fiche de l'annuaire ouvert revendiquée : elle disparaît au profit de la vraie page réservable.
    const listingId = String(formData.get("fiche") ?? "");
    if (/^[0-9a-f-]{36}$/.test(listingId)) {
      await admin.from("directory_listings").update({ claimed_business_id: business.id }).eq("id", listingId).is("claimed_business_id", null);
    }

    // Parrainage : rattache le filleul au parrain (récompense au premier paiement, cf. webhook Stripe).
    const jar = await cookies();
    const ref = jar.get("rdv_ref")?.value;
    if (ref && /^[a-z0-9]{6,16}$/.test(ref)) {
      const { data: referrer } = await admin.from("businesses").select("id").eq("referral_code", ref).neq("id", business.id).maybeSingle<{ id: string }>();
      if (referrer) await admin.from("businesses").update({ referred_by: referrer.id }).eq("id", business.id);
      jar.delete("rdv_ref");
    }

    const seeds = await Promise.all([
      admin.from("services").insert(buildSeedServices(category).map((s) => ({ ...s, business_id: business.id }))),
      buildSeedAddons(category).length
        ? admin.from("addons").insert(buildSeedAddons(category).map((a) => ({ ...a, business_id: business.id })))
        : Promise.resolve({ error: null }),
      admin.from("opening_hours").insert(buildSeedHours(category).map((h) => ({ ...h, business_id: business.id }))),
    ]);
    const seedError = seeds.find((r) => r.error)?.error;
    if (seedError) throw new Error(seedError.message);

    // Boucle commerciale : le prospect qui s'inscrit passe en « converted », ses fils sont rattachés.
    const emails = Array.from(new Set([input.email, (user.email ?? "").toLowerCase()].filter(Boolean)));
    await admin.from("prospects").update({ status: "converted", next_followup_at: null }).in("email", emails);
    await admin.from("email_threads").update({ business_id: business.id }).in("contact_email", emails);
    await pingIndexNow(businessUrlsToPing({ slug, category: category.slug, city_slug: slugify(city) }));
  } catch (err) {
    await logEvent("onboarding", errorMessage(err), { user_id: user.id });
    return { error: "server" };
  }
  redirect("/pro/agenda?bienvenue=1");
}
