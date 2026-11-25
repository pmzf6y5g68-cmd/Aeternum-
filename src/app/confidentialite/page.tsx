import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      sections={[
        {
          title: "Responsables de traitement",
          paragraphs: [
            `${siteConfig.legal.companyName} est responsable des traitements liés aux comptes (Usagers et Professionnels), à la recherche, aux avis et à la prospection. Pour la gestion des rendez-vous qu'il reçoit, chaque Professionnel est responsable de traitement et ${siteConfig.name} agit en sous-traitant.`,
          ],
        },
        {
          title: "Données collectées",
          paragraphs: [
            "Usagers : email, nom, téléphone, adresse d'intervention éventuelle, rendez-vous, favoris, avis. Position approximative uniquement si vous utilisez « Autour de moi » (jamais stockée).",
            "Professionnels : nom commercial, coordonnées, adresse, catalogue de prestations, équipe, horaires, données de facturation (gérées par Stripe).",
            "Prospection B2B : coordonnées professionnelles publiques (site web, email de contact) et historique des échanges par email.",
          ],
        },
        {
          title: "Finalités et bases légales",
          paragraphs: [
            "Exécution du contrat (recherche, réservation, rappels, avis, facturation), intérêt légitime (prospection B2B de professionnels, sécurité, prévention de la fraude), obligations légales (comptabilité).",
          ],
        },
        {
          title: "Prospection et opposition",
          paragraphs: [
            `Chaque email de prospection permet de s'opposer à tout nouvel envoi en répondant « STOP » : la demande est traitée automatiquement et immédiatement. Les réponses peuvent être analysées par un assistant automatisé (IA) ; toute demande sensible est transmise à un humain.`,
          ],
        },
        {
          title: "Sous-traitants",
          paragraphs: [
            `Hébergement : ${siteConfig.legal.host} et ${siteConfig.legal.dataHost}. Paiements : Stripe. Emails : Resend et Cloudflare. Assistant email : Anthropic. Géocodage : Base Adresse Nationale (data.gouv.fr) et OpenStreetMap Nominatim. Cartes : OpenStreetMap.`,
          ],
        },
        {
          title: "Durées de conservation",
          paragraphs: [
            "Comptes : durée d'utilisation puis 3 ans d'inactivité. Rendez-vous : 3 ans après la prestation. Avis : tant que l'établissement est en ligne. Prospects sans réponse : 3 ans après le dernier contact. Données comptables : 10 ans.",
          ],
        },
        {
          title: "Vos droits",
          paragraphs: [`Accès, rectification, effacement, opposition, limitation et portabilité : ${siteConfig.supportEmail}. Vous pouvez saisir la CNIL (www.cnil.fr).`],
        },
      ]}
    />
  );
}
