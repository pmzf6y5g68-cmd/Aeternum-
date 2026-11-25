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
          title: "Responsable de traitement",
          paragraphs: [
            `${siteConfig.legal.companyName} est responsable des traitements liés aux comptes des Studios et à la prospection. Pour les données des clients finaux saisies lors d'une réservation, le Studio est responsable de traitement et ${siteConfig.name} agit en sous-traitant.`,
          ],
        },
        {
          title: "Données collectées",
          paragraphs: [
            "Studios : nom commercial, email, téléphone, adresse, paramètres tarifaires, données de facturation (gérées par Stripe).",
            "Clients finaux : nom, email, téléphone, adresse d'intervention, véhicule et rendez-vous. Ces données ne sont visibles que par le Studio concerné.",
            "Prospection B2B : coordonnées professionnelles publiques des studios (site web, email de contact) et historique des échanges par email.",
          ],
        },
        {
          title: "Finalités et bases légales",
          paragraphs: [
            "Exécution du contrat (prise de rendez-vous, rappels, facturation), intérêt légitime (prospection B2B de professionnels, sécurité, prévention de la fraude), obligations légales (comptabilité).",
          ],
        },
        {
          title: "Prospection et opposition",
          paragraphs: [
            `Chaque email de prospection permet de s'opposer à tout nouvel envoi : il suffit de répondre « STOP ». La demande est traitée automatiquement et immédiatement. Vous pouvez aussi écrire à ${siteConfig.supportEmail}.`,
            "Les réponses aux emails peuvent être analysées par un assistant automatisé (IA) afin de vous répondre rapidement ; toute demande sensible est transmise à un humain.",
          ],
        },
        {
          title: "Sous-traitants",
          paragraphs: [
            `Hébergement : ${siteConfig.legal.host} et ${siteConfig.legal.dataHost}. Paiements : Stripe. Emails : Resend et Cloudflare. Assistant email : Anthropic. Géocodage : Base Adresse Nationale (data.gouv.fr) et OpenStreetMap Nominatim.`,
          ],
        },
        {
          title: "Durées de conservation",
          paragraphs: [
            "Comptes Studios : durée de l'abonnement puis 3 ans. Rendez-vous : 3 ans après la prestation. Prospects sans réponse : 3 ans après le dernier contact. Données comptables : 10 ans.",
          ],
        },
        {
          title: "Vos droits",
          paragraphs: [
            `Vous disposez des droits d'accès, de rectification, d'effacement, d'opposition, de limitation et de portabilité : ${siteConfig.supportEmail}. Vous pouvez saisir la CNIL (www.cnil.fr).`,
          ],
        },
      ]}
    />
  );
}
