/** Segments réservés par l'application : un studio ne peut pas les utiliser comme slug. */
export const RESERVED_SLUGS = new Set([
  "api", "auth", "login", "logout", "onboarding", "dashboard", "confirm", "cancel", "cgu", "confidentialite",
  "mentions-legales", "admin", "app", "www", "static", "_next", "favicon-ico", "robots-txt", "sitemap-xml", "slotly",
]);

export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  const slug = base.length >= 3 ? base : `studio-${base || "detailing"}`;
  return RESERVED_SLUGS.has(slug) ? `${slug}-studio` : slug;
}
