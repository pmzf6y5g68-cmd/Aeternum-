import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Conditions générales d'utilisation" };

const p = siteConfig.pricing;

export default function CguPage() {
  return (
    <LegalPage
      title="Conditions générales d'utilisation"
      sections={[
        {
          title: "1. Objet",
          paragraphs: [
            `${siteConfig.name} fournit aux professionnels du detailing automobile (« le Studio ») une page de réservation en ligne, un agenda et des outils de rappel. Les présentes CGU régissent l'utilisation du service par les Studios et par leurs clients finaux.`,
          ],
        },
        {
          title: "2. Offres",
          paragraphs: [
            `Plan Gratuit : jusqu'à ${p.freeMonthlyBookings} rendez-vous par mois civil. Plan Pro : ${p.proMonthlyPriceEur} € TTC par mois, rendez-vous illimités, options upsell, rappels et relances automatiques, avec ${p.proTrialDays} jours d'essai offerts.`,
            "L'abonnement Pro est sans engagement, renouvelé chaque mois et résiliable à tout moment depuis le portail de facturation ; la résiliation prend effet à la fin de la période en cours.",
          ],
        },
        {
          title: "3. Acomptes",
          paragraphs: [
            `Les acomptes sont encaissés directement par le Studio via son propre compte Stripe Connect. ${siteConfig.name} n'encaisse ni ne détient jamais de fonds pour le compte des Studios. La politique de remboursement des acomptes relève exclusivement du Studio.`,
          ],
        },
        {
          title: "4. Rendez-vous",
          paragraphs: [
            "Le prix affiché au client est calculé à partir des tarifs renseignés par le Studio (gabarit, options, frais de déplacement). Le Studio reste seul responsable de la prestation réalisée, de ses tarifs et du respect de ses obligations professionnelles.",
            "Un créneau en attente d'acompte est réservé pendant 20 minutes ; passé ce délai, il est automatiquement libéré.",
          ],
        },
        {
          title: "5. Responsabilité",
          paragraphs: [
            `${siteConfig.name} met en œuvre les moyens raisonnables pour assurer la disponibilité du service, sans garantie de disponibilité continue. Sa responsabilité ne saurait être engagée pour les litiges entre un Studio et ses clients.`,
          ],
        },
        { title: "6. Droit applicable", paragraphs: ["Les présentes CGU sont soumises au droit français. À défaut d'accord amiable, les tribunaux de Paris sont compétents."] },
      ]}
    />
  );
}
