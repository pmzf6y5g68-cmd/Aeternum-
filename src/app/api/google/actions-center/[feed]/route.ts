import { isAuthorizedCron } from "@/lib/cron";
import { e164 } from "@/lib/domain/phone";
import { env } from "@/lib/env";
import { json, jsonError } from "@/lib/http";
import { businessPath } from "@/lib/slug";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Flux Google Actions Center « Appointments Redirect » (bouton Réserver natif sur Google Maps pour tous les
 * établissements d'un coup, une fois le partenariat validé par Google). Format : { data: [...] } — entity
 * (téléphone obligatoire) et action (appointment_info vide, lien profond). Générés chaque jour par le cron
 * puis déposés par SFTP chez Google ; protégés par CRON_SECRET (contiennent les téléphones publics).
 */
interface Row {
  id: string;
  slug: string;
  name: string;
  category: string;
  city_slug: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

export async function GET(request: Request, { params }: { params: Promise<{ feed: string }> }) {
  if (!isAuthorizedCron(request)) return jsonError("unauthorized", 401);
  const { feed } = await params;
  if (feed !== "entity" && feed !== "action") return jsonError("not_found", 404);
  const { data } = await createAdminClient()
    .from("businesses")
    .select("id, slug, name, category, city_slug, phone, address, postal_code, city, lat, lng")
    .eq("published", true)
    .not("phone", "is", null)
    .order("id")
    .limit(50_000)
    .returns<Row[]>();
  const rows = (data ?? []).filter((b) => e164(b.phone));
  const base = env.appUrl();
  if (feed === "entity") {
    return json({
      data: rows.map((b) => ({
        entity_id: b.id,
        name: b.name,
        telephone: e164(b.phone),
        url: `${base}${businessPath(b)}`,
        ...(b.lat !== null && b.lng !== null
          ? { location: { latitude: b.lat, longitude: b.lng, address: { country: "FR", locality: b.city ?? "", postal_code: b.postal_code ?? "", street_address: b.address ?? "" } } }
          : {}),
      })),
    });
  }
  return json({
    data: rows.map((b) => ({
      entity_id: b.id,
      link_id: `rdv-${b.id}`,
      url: `${base}${businessPath(b)}?utm_source=google&utm_medium=actions_center#reserver`,
      actions: [{ appointment_info: {} }],
    })),
  });
}
