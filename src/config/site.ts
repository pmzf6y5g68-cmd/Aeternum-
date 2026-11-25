/**
 * Configuration publique : identité légale, tarifs, règles de réservation.
 * Les pages légales et la base de connaissances de l'agent email lisent ces valeurs.
 */
export const siteConfig = {
  name: "Rendez-vous",
  tagline: "Tous vos rendez-vous, au même endroit",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supportEmail: "bonjour@rendez-vous.app",
  legal: {
    companyName: "Rendez-vous SAS",
    legalForm: "SAS au capital de 1 000 €",
    siren: "000 000 000",
    rcs: "RCS Paris",
    vatNumber: "FR00000000000",
    address: "10 rue de la Paix, 75002 Paris, France",
    publicationDirector: "Le Président de Rendez-vous SAS",
    host: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA",
    dataHost: "Supabase Inc. (région UE)",
    lastUpdated: "25 novembre 2026",
  },
  pricing: {
    freeMonthlyBookings: 30,
    proMonthlyPriceEur: 49,
    proTrialDays: 14,
    /** Plan Gratuit : commission sur la 1re réservation d'un nouveau client venu de la marketplace. */
    newClientCommissionPercent: 20,
    newClientCommissionCapEur: 20,
    /** Un client redevient « nouveau » après ce délai sans rendez-vous chez l'établissement. */
    newClientWindowDays: 365,
  },
  booking: {
    pendingDepositTtlMinutes: 20,
    pendingCleanupMinutes: 25,
    defaultSlotStepMinutes: 30,
    defaultMinLeadMinutes: 120,
    defaultMaxDaysAhead: 60,
    defaultCancellationHours: 24,
    timeZone: "Europe/Paris",
  },
  search: {
    pageSize: 20,
    defaultRadiusKm: 25,
    /** Nombre de jours de créneaux affichés dans chaque carte de résultat. */
    previewDays: 4,
  },
  emailAgent: {
    maxAiRepliesPerThread: 4,
    maxReplyWords: 110,
  },
} as const;

export type SiteConfig = typeof siteConfig;
