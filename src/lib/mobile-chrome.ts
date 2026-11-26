/** Quelle barre fixe s'affiche en bas de l'écran mobile pour une page donnée. */
const HIDDEN = ["/pro", "/paiement", "/widget", "/login", "/auth", "/cancel", "/confirm", "/avis", "/carnet/paiement", "/carte-cadeau/paiement", "/desinscription"];

export const isBusinessPage = (p: string) => /^\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]{3,60}$/.test(p) && !p.startsWith("/compte");

export function mobileBar(pathname: string): "tabs" | "book" | "none" {
  if (HIDDEN.some((h) => pathname === h || pathname.startsWith(`${h}/`))) return "none";
  if (isBusinessPage(pathname)) return "book";
  return "tabs";
}
