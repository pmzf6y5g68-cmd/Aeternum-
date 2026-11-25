/**
 * Base de connaissances produit STRICTE fournie à l'agent email.
 * Toute affirmation de l'agent doit provenir de ce texte ou du contexte du contact.
 */
import { siteConfig } from "@/config/site";

const p = siteConfig.pricing;

export const PRODUCT_FACTS = `
# Slotly — faits vérifiés (seule source autorisée)
- Slotly est une page de réservation en ligne pour les studios de detailing automobile, fixes (atelier) et mobiles (à domicile).
- Le client final réserve sans créer de compte, en 4 étapes : lieu (atelier ou domicile, frais kilométriques calculés en direct à partir de l'adresse), gabarit du véhicule (citadine, berline/break, SUV/4x4, utilitaire/van) + prestation, options (upsell, plan Pro), créneau libre + coordonnées.
- Les prix et durées s'adaptent automatiquement au gabarit. Les frais de déplacement : rayon gratuit (15 km par défaut), puis tarif au km (1,20 € par défaut), jusqu'à un rayon maximum (45 km par défaut). Le detailer règle tout lui-même.
- Zéro double réservation : seuls les créneaux réellement libres sont proposés, avec un tampon de trajet pour les interventions à domicile.
- Acomptes anti-lapin : encaissés directement sur le compte Stripe du detailer (Stripe Connect Express). Slotly ne touche jamais l'argent. Activation en 1 clic depuis le tableau de bord. Sans Stripe, le studio fonctionne avec paiement sur place.
- Le client reçoit un email de confirmation avec invitation calendrier (.ics) et un lien d'annulation.
- Plan Gratuit : 0 €, ${p.freeMonthlyBookings} rendez-vous par mois, page de réservation, QR code, tarifs par gabarit, frais km, acomptes.
- Plan Pro : ${p.proMonthlyPriceEur} € par mois, ${p.proTrialDays} jours d'essai offerts, sans engagement, résiliable à tout moment. Inclut : rendez-vous illimités, options upsell dans le tunnel, rappel J-1 avec confirmation en 1 clic, alerte au detailer 6 h avant si le client n'a pas confirmé, relance entretien automatique après 90 jours (réglable).
- Création de la page en environ 60 secondes : 4 prestations, 4 options et des horaires standard sont créés automatiquement et restent modifiables.
- Outils de partage : lien unique, QR code téléchargeable, script de répondeur, guide pour Google Maps et la bio Instagram.
- Il n'existe AUCUNE remise, code promo, tarif annuel, frais d'installation, application mobile native, synchronisation Google Agenda, SMS, paiement intégral en ligne, multi-employés, multi-sites, ou intégration comptable. Ne les promets jamais.
- Support : ${siteConfig.supportEmail}.
`.trim();
