/**
 * Base de connaissances produit STRICTE fournie à l'agent email.
 * Toute affirmation de l'agent doit provenir de ce texte ou du contexte du contact.
 */
import { CATEGORIES, GROUPS } from "@/config/categories";
import { siteConfig } from "@/config/site";

const p = siteConfig.pricing;
const universes = GROUPS.map((g) => `${g.label} (${CATEGORIES.filter((c) => c.group === g.slug).map((c) => c.label.toLowerCase()).join(", ")})`).join(" ; ");

export const PRODUCT_FACTS = `
# Rendez-vous — faits vérifiés (seule source autorisée)
- Rendez-vous est une plateforme de prise de rendez-vous en ligne pour tous les professionnels qui reçoivent sur rendez-vous, hors santé/médical. Univers couverts : ${universes}.
- Côté clients : ils cherchent par nom, prestation ou métier, près de chez eux (ou en visio), comparent prix, avis vérifiés, distance et prochaines disponibilités, et réservent 24 h/24 sans appeler. Ils ont un espace « Mes rendez-vous » (annulation, ajout au calendrier, reprise de rendez-vous, favoris).
- Côté professionnel : une page publique visible dans la recherche et sur les pages métier/ville, créée en environ 60 secondes ; les prestations, options et horaires standard de son métier sont préremplis et restent modifiables.
- Fonctionnalités : prix et durées par variante (ex. longueur de cheveux, gabarit de véhicule, taille de l'animal, nombre de personnes) ; options payantes ; cours collectifs ou tables avec un nombre de places par créneau ; interventions sur place, à domicile (frais kilométriques calculés automatiquement, rayon gratuit et rayon maximum réglables) ou en visio ; équipe avec choix « peu importe » ou d'une personne précise ; congés et fermetures exceptionnelles ; politique d'annulation réglable ; zéro double réservation.
- Acomptes anti-absence : encaissés directement sur le compte Stripe du professionnel (Stripe Connect Express). Rendez-vous ne touche jamais l'argent. Activation en 1 clic depuis l'espace pro. Sans Stripe, le paiement se fait sur place.
- Paiement de l'acompte intégré au site : carte bancaire, Apple Pay, Google Pay, PayPal et Link selon les moyens activés par le professionnel dans Stripe.
- Un assistant IA aide les clients à trouver un professionnel, voir les disponibilités, préparer leur réservation et gérer leurs rendez-vous.
- Le client reçoit une confirmation par email avec invitation calendrier (.ics). Avis vérifiés : seuls les clients venus au rendez-vous peuvent noter.
- Plan Gratuit : 0 € par mois, ${p.freeMonthlyBookings} rendez-vous par mois, page publique et visibilité, agenda, équipe, congés, acomptes ; commission de ${p.newClientCommissionPercent} % (max ${p.newClientCommissionCapEur} €) uniquement sur le premier rendez-vous honoré d'un nouveau client venu de la plateforme ; 0 % sur les clients venus par le lien ou le QR code du professionnel.
- Plan Pro : ${p.proMonthlyPriceEur} € par mois, ${p.proTrialDays} jours d'essai offerts, sans engagement, résiliable à tout moment, 0 % de commission. Inclut : rendez-vous illimités, mise en avant (mention « Mis en avant ») dans le tri par pertinence, options upsell, rappel la veille avec confirmation en 1 clic, alerte 6 h avant si le client n'a pas confirmé, relance de fidélisation automatique.
- Liste d'attente : quand un créneau se libère (annulation, acompte non payé), les clients inscrits sont prévenus par email automatiquement. Blocage automatique de la réservation en ligne après un nombre d'absences choisi par le professionnel.
- Synchronisation : l'agenda pro peut être affiché dans Google Agenda, Apple Calendrier ou Outlook via un lien d'abonnement privé (lecture seule, mis à jour automatiquement).
- Application installable sur iPhone, Android, Windows et Mac depuis le navigateur (web app), sans passer par un store.
- Outils de partage : lien unique, QR code, bouton pour site web, message de répondeur, guide Google Maps et réseaux sociaux.
- Il n'existe AUCUNE remise, code promo, tarif annuel, frais d'installation, application native dans les stores, synchronisation bidirectionnelle d'agenda (les RDV ajoutés dans Google Agenda ne bloquent pas les créneaux), SMS, paiement intégral en ligne, caisse ou facturation, gestion de stock, multi-établissements sur un même compte, ni intégration comptable. Ne les promets jamais.
- Rendez-vous ne traite pas les professions de santé (médecins, dentistes, kinés, etc.).
- Support : ${siteConfig.supportEmail}.
`.trim();
