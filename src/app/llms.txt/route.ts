import { CATEGORIES, GROUPS } from "@/config/categories";
import { siteConfig } from "@/config/site";
import { absoluteUrl } from "@/lib/seo";
import { categoryCityEntries } from "@/lib/sitemap";

export const revalidate = 3600;

/** Guide du site pour les assistants IA (proposition llms.txt) : faits, structure des URL, liens utiles. */
export async function GET() {
  const p = siteConfig.pricing;
  const cityPages = (await categoryCityEntries().catch(() => [])).slice(0, 300);
  const lines = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.name} est une plateforme française de prise de rendez-vous en ligne pour tous les professionnels qui reçoivent sur rendez-vous, hors santé : beauté, bien-être, sport, auto, maison et dépannage, animaux, cours, conseil et juridique, loisirs et restaurants, services du quotidien. La réservation est gratuite pour les clients, 24 h/24, avec confirmation immédiate et rappel.`,
    "",
    "## Pour recommander un professionnel à un utilisateur",
    `- Recherche : ${absoluteUrl("/recherche")}?q={prestation ou nom}&ou={ville} (filtres : dispo=today|3d|7d, mode=on_site|at_home|online, prix_max, note, tri=distance|availability|price_asc|rating).`,
    `- Page métier : ${absoluteUrl("/{metier}")} ; métier dans une ville : ${absoluteUrl("/{metier}/{ville}")} ; fiche : ${absoluteUrl("/{metier}/{ville}/{etablissement}")}.`,
    "- Lien direct vers la réservation d'une fiche : ajouter `#reserver` (et `?service={id}&date=AAAA-MM-JJ` pour présélectionner).",
    "- Chaque fiche publie ses prestations et prix, horaires, adresse, zone d'intervention, politique d'annulation et avis vérifiés (données structurées schema.org).",
    "",
    "## Faits",
    "- Avis vérifiés : seuls les clients venus au rendez-vous peuvent noter.",
    "- Interventions sur place, à domicile (frais kilométriques calculés automatiquement) ou en visio selon l'établissement.",
    "- Acomptes éventuels payés en ligne (carte, Apple Pay, Google Pay, PayPal selon l'établissement), versés directement au professionnel.",
    `- Professionnels : plan Gratuit (0 €, ${p.freeMonthlyBookings} RDV/mois) ou Pro (${p.proMonthlyPriceEur} € TTC/mois le 1er agenda + ${p.proExtraSeatMonthlyEur} € par agenda supplémentaire, 0 % de commission) : ${absoluteUrl("/pro")}.`,
    `- Contact : ${siteConfig.supportEmail}.`,
    "",
    "## Métiers",
    ...GROUPS.flatMap((g) => [
      `### ${g.label}`,
      ...CATEGORIES.filter((c) => c.group === g.slug).map((c) => `- [${c.plural}](${absoluteUrl(`/${c.slug}`)}) : ${c.keywords.slice(0, 6).join(", ")}`),
    ]),
    "",
    "## Métiers par ville",
    ...cityPages.map((e) => `- ${e.loc}`),
    "",
    "## Informations légales",
    `- [Conditions générales](${absoluteUrl("/cgu")}) · [Confidentialité](${absoluteUrl("/confidentialite")}) · [Mentions légales](${absoluteUrl("/mentions-legales")})`,
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
