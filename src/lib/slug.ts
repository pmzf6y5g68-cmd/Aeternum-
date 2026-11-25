import { CATEGORY_BY_SLUG } from "@/config/categories";

/** Segments réservés par l'application. */
export const RESERVED_SLUGS = new Set([
  "api", "auth", "login", "logout", "pro", "compte", "recherche", "confirm", "cancel", "avis", "cgu", "confidentialite",
  "mentions-legales", "admin", "app", "www", "static", "_next", "rendez-vous",
]);

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

export function businessSlug(name: string, city: string | null): string {
  const base = slugify(name);
  const slug = base.length >= 3 ? base : `${base || "pro"}-${slugify(city ?? "") || "rdv"}`;
  return RESERVED_SLUGS.has(slug) || CATEGORY_BY_SLUG.has(slug) ? `${slug}-${slugify(city ?? "") || "pro"}` : slug;
}

/** URL canonique d'une fiche : /{catégorie}/{ville}/{établissement}. */
export function businessPath(b: { category: string; city_slug: string | null; slug: string }): string {
  return `/${b.category}/${b.city_slug || "france"}/${b.slug}`;
}
