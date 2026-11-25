/**
 * Configuration publique du site : identité légale, tarifs, contacts.
 * Les pages légales et la base de connaissances de l'agent email lisent ces valeurs :
 * modifier ici suffit à tout mettre à jour.
 */
export const siteConfig = {
  name: "Slotly",
  tagline: "La réservation en ligne pensée pour le detailing automobile",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supportEmail: "bonjour@slotly.fr",
  legal: {
    companyName: "Slotly SAS",
    legalForm: "SAS au capital de 1 000 €",
    siren: "000 000 000",
    rcs: "RCS Paris",
    vatNumber: "FR00000000000",
    address: "10 rue de la Paix, 75002 Paris, France",
    publicationDirector: "Le Président de Slotly SAS",
    host: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA",
    dataHost: "Supabase Inc. (région UE)",
    lastUpdated: "25 novembre 2026",
  },
  pricing: {
    freeMonthlyBookings: 15,
    proMonthlyPriceEur: 49,
    proTrialDays: 14,
  },
  booking: {
    pendingDepositTtlMinutes: 20,
    pendingCleanupMinutes: 25,
    slotStepMinutes: 30,
    minLeadMinutes: 120,
    maxDaysAhead: 60,
    timeZone: "Europe/Paris",
  },
  emailAgent: {
    maxAiRepliesPerThread: 4,
    maxReplyWords: 110,
  },
} as const;

export type SiteConfig = typeof siteConfig;
