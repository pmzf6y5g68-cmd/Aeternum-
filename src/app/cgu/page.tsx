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
            `${siteConfig.name} est une plateforme qui met en relation des utilisateurs (« Usagers ») avec des professionnels recevant sur rendez-vous (« Professionnels »), hors professions de santé. ${siteConfig.name} agit en intermédiaire technique : le contrat de prestation est conclu directement entre l'Usager et le Professionnel.`,
          ],
        },
        {
          title: "2. Usagers",
          paragraphs: [
            "La recherche et la réservation sont gratuites pour les Usagers. Un compte (connexion par lien envoyé par email) permet de retrouver, annuler et reprendre ses rendez-vous et de gérer ses favoris.",
            "L'Usager s'engage à fournir des coordonnées exactes et à honorer ses rendez-vous ou à les annuler dans le délai prévu par la politique d'annulation affichée sur la page du Professionnel. En cas d'acompte, son remboursement relève exclusivement du Professionnel.",
          ],
        },
        {
          title: "3. Professionnels",
          paragraphs: [
            p.newClientCommissionPercent > 0
              ? `Plan Gratuit : 0 € par mois, jusqu'à ${p.freeMonthlyBookings} rendez-vous par mois civil, et une commission de ${p.newClientCommissionPercent} % (plafonnée à ${p.newClientCommissionCapEur} € HT) sur le premier rendez-vous honoré de chaque nouveau client venu de la plateforme (client sans rendez-vous chez le Professionnel depuis ${p.newClientWindowDays} jours). Aucune commission sur les clients arrivés par les liens, QR codes ou boutons propres au Professionnel.`
              : `Plan Gratuit : 0 € par mois, sans carte bancaire et sans commission, jusqu'à ${p.freeMonthlyBookings} rendez-vous par mois civil.`,
            `Plan Pro : ${p.proMonthlyPriceEur} € TTC par mois pour le premier agenda, puis ${p.proExtraSeatMonthlyEur} € TTC par agenda supplémentaire (membre d'équipe actif), ou ${p.proYearlyPriceEur} € TTC par an et ${p.proExtraSeatYearlyEur} € TTC par agenda supplémentaire en paiement annuel. Aucune commission, rendez-vous illimités, ${p.proTrialDays} jours d'essai offerts, sans engagement, résiliable à tout moment depuis le portail de facturation. L'ajout ou le retrait d'un agenda est facturé au prorata.`,
            "Le Professionnel est seul responsable des informations publiées (prestations, prix, horaires, adresse), de la prestation réalisée et du respect de ses obligations légales et réglementaires.",
          ],
        },
        {
          title: "4. Paiements et acomptes",
          paragraphs: [
            `Les acomptes sont encaissés directement par le Professionnel via son propre compte Stripe Connect. ${siteConfig.name} n'encaisse ni ne détient jamais de fonds pour le compte des Professionnels. Un créneau en attente d'acompte est réservé 20 minutes, puis libéré.`,
          ],
        },
        {
          title: "5. Avis",
          paragraphs: [
            "Seuls les Usagers ayant effectivement eu rendez-vous peuvent publier un avis, une seule fois par rendez-vous. Les avis sont publiés sans modération préalable, sans contrepartie, et classés par date. Le Professionnel peut y répondre publiquement. Tout avis illicite peut être signalé à " +
              siteConfig.supportEmail +
              ".",
          ],
        },
        {
          title: "6. Classement des résultats",
          paragraphs: [
            "Par défaut (tri « Pertinence »), les résultats sont classés selon la correspondance avec la recherche (nom, métier, prestations), puis la note moyenne pondérée par le nombre d'avis et la distance. Les établissements abonnés au plan Pro bénéficient d'un léger bonus dans ce seul tri et portent la mention « Mis en avant ». Les tris par distance, prix, note ou disponibilité ne sont influencés par aucune rémunération.",
          ],
        },
        {
          title: "7. Responsabilité et droit applicable",
          paragraphs: [
            `${siteConfig.name} met en œuvre les moyens raisonnables pour assurer la disponibilité du service, sans garantie de continuité, et n'est pas partie aux litiges entre Usagers et Professionnels. Les présentes CGU sont soumises au droit français ; à défaut d'accord amiable, les tribunaux de Paris sont compétents, sous réserve des règles protectrices des consommateurs.`,
          ],
        },
      ]}
    />
  );
}
