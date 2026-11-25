/**
 * Catalogue universel des métiers couverts par Rendez-vous (tout sauf le médical).
 * Chaque catégorie définit : ses modes d'intervention, sa dimension de variante (gabarit, longueur,
 * taille de l'animal, nombre de personnes…) et le catalogue de démarrage créé en 1 clic à l'onboarding.
 */
export type LocationMode = "on_site" | "at_home" | "online";
export const LOCATION_MODES: LocationMode[] = ["on_site", "at_home", "online"];

export type IconName =
  | "Scissors" | "Sparkles" | "Hand" | "Flower2" | "Bath" | "Brush" | "Palette" | "PenTool" | "Eye" | "Dumbbell"
  | "PersonStanding" | "Guitar" | "Languages" | "GraduationCap" | "Car" | "Wrench" | "CarFront" | "Bike" | "Droplets"
  | "Zap" | "KeyRound" | "House" | "Leaf" | "Truck" | "Laptop" | "PawPrint" | "Dog" | "Scale" | "Landmark"
  | "Calculator" | "Camera" | "Utensils" | "Puzzle" | "Shirt" | "Footprints" | "Briefcase" | "HeartHandshake"
  | "Gem" | "Flame" | "Drill" | "PartyPopper" | "BookOpen" | "Monitor" | "ClipboardList" | "Building" | "Video"
  | "Sofa" | "Ruler" | "Store" | "Wind" | "Gamepad2" | "Ticket" | "Wine" | "ChefHat" | "Activity";

export interface VariantTemplate {
  key: string;
  label: string;
  /** Multiplicateurs appliqués au prix / à la durée de la prestation de base. */
  priceFactor: number;
  durationFactor: number;
}

/** [nom, prix €, durée min, description] */
export type SeedService = [string, number, number, string];
/** [nom, prix €, durée min] */
export type SeedAddon = [string, number, number];

export interface CategoryDef {
  slug: string;
  label: string;
  /** Libellé au pluriel pour les pages de liste (« Coiffeurs à Lyon »). */
  plural: string;
  group: GroupSlug;
  icon: IconName;
  keywords: string[];
  modes: LocationMode[];
  variantLabel?: string;
  variants?: VariantTemplate[];
  /** Places simultanées par créneau (cours collectifs, tables…). */
  capacity?: number;
  seed: SeedService[];
  addons?: SeedAddon[];
  /** Requête Google Maps utilisée par le robot de prospection. */
  prospectQuery: string;
}

export type GroupSlug = "beaute" | "bien-etre" | "sport" | "auto" | "maison" | "animaux" | "cours" | "conseil" | "loisirs" | "services";

export const GROUPS: { slug: GroupSlug; label: string; icon: IconName }[] = [
  { slug: "beaute", label: "Beauté", icon: "Scissors" },
  { slug: "bien-etre", label: "Bien-être", icon: "Flower2" },
  { slug: "sport", label: "Sport & coaching", icon: "Dumbbell" },
  { slug: "auto", label: "Auto & moto", icon: "Car" },
  { slug: "maison", label: "Maison & dépannage", icon: "House" },
  { slug: "animaux", label: "Animaux", icon: "PawPrint" },
  { slug: "cours", label: "Cours & formation", icon: "GraduationCap" },
  { slug: "conseil", label: "Conseil & juridique", icon: "Briefcase" },
  { slug: "loisirs", label: "Loisirs & sorties", icon: "PartyPopper" },
  { slug: "services", label: "Services du quotidien", icon: "Store" },
];

const HAIR: VariantTemplate[] = [
  { key: "courts", label: "Cheveux courts", priceFactor: 1, durationFactor: 1 },
  { key: "mi-longs", label: "Cheveux mi-longs", priceFactor: 1.2, durationFactor: 1.15 },
  { key: "longs", label: "Cheveux longs", priceFactor: 1.4, durationFactor: 1.3 },
];
const VEHICLE: VariantTemplate[] = [
  { key: "citadine", label: "Citadine", priceFactor: 0.85, durationFactor: 0.85 },
  { key: "berline", label: "Berline / Break", priceFactor: 1, durationFactor: 1 },
  { key: "suv", label: "SUV / 4x4", priceFactor: 1.2, durationFactor: 1.2 },
  { key: "utilitaire", label: "Utilitaire / Van", priceFactor: 1.35, durationFactor: 1.35 },
];
const PET: VariantTemplate[] = [
  { key: "petit", label: "Petit (< 10 kg)", priceFactor: 1, durationFactor: 1 },
  { key: "moyen", label: "Moyen (10-25 kg)", priceFactor: 1.3, durationFactor: 1.25 },
  { key: "grand", label: "Grand (> 25 kg)", priceFactor: 1.6, durationFactor: 1.5 },
];
const SURFACE: VariantTemplate[] = [
  { key: "s", label: "Jusqu'à 50 m²", priceFactor: 1, durationFactor: 1 },
  { key: "m", label: "50 à 100 m²", priceFactor: 1.6, durationFactor: 1.6 },
  { key: "l", label: "Plus de 100 m²", priceFactor: 2.3, durationFactor: 2.3 },
];
const PARTY: VariantTemplate[] = [
  { key: "2", label: "1 à 2 personnes", priceFactor: 1, durationFactor: 1 },
  { key: "4", label: "3 à 4 personnes", priceFactor: 1, durationFactor: 1 },
  { key: "6", label: "5 à 6 personnes", priceFactor: 1, durationFactor: 1.2 },
];
const GROUP_SIZE: VariantTemplate[] = [
  { key: "2", label: "2 joueurs", priceFactor: 1, durationFactor: 1 },
  { key: "4", label: "3 à 4 joueurs", priceFactor: 1.7, durationFactor: 1 },
  { key: "6", label: "5 à 6 joueurs", priceFactor: 2.3, durationFactor: 1 },
];

export const CATEGORIES: CategoryDef[] = [
  // --- Beauté -----------------------------------------------------------------------------
  {
    slug: "coiffeur", label: "Coiffeur", plural: "Coiffeurs", group: "beaute", icon: "Scissors",
    keywords: ["coiffure", "coupe", "brushing", "couleur", "balayage", "salon"], modes: ["on_site", "at_home"],
    variantLabel: "Longueur des cheveux", variants: HAIR, prospectQuery: "salon de coiffure",
    seed: [
      ["Coupe + brushing femme", 45, 60, "Shampoing, coupe et brushing."],
      ["Coupe homme", 25, 30, "Shampoing, coupe et coiffage."],
      ["Couleur + brushing", 65, 90, "Coloration racines ou complète, brushing."],
      ["Balayage + brushing", 110, 150, "Éclaircissement naturel, patine, brushing."],
    ],
    addons: [["Soin profond", 15, 15], ["Masque kératine", 25, 20], ["Coupe enfant", 15, 20]],
  },
  {
    slug: "barbier", label: "Barbier", plural: "Barbiers", group: "beaute", icon: "Scissors",
    keywords: ["barbe", "coupe homme", "rasage", "dégradé", "barber"], modes: ["on_site"], prospectQuery: "barbier",
    seed: [
      ["Coupe homme", 22, 30, "Coupe aux ciseaux ou à la tondeuse."],
      ["Coupe + barbe", 35, 45, "Coupe et taille de barbe à la serviette chaude."],
      ["Taille de barbe", 18, 20, "Contours au rasoir, soin."],
      ["Rasage traditionnel", 25, 30, "Rasage à l'ancienne, serviette chaude."],
    ],
    addons: [["Soin visage express", 10, 10], ["Coloration barbe", 12, 15]],
  },
  {
    slug: "institut-de-beaute", label: "Institut de beauté", plural: "Instituts de beauté", group: "beaute", icon: "Sparkles",
    keywords: ["esthéticienne", "soin visage", "épilation", "beauté", "institut"], modes: ["on_site", "at_home"], prospectQuery: "institut de beauté",
    seed: [
      ["Soin visage éclat", 55, 60, "Nettoyage, gommage, masque et massage."],
      ["Épilation jambes complètes", 35, 40, "Cire tiède."],
      ["Épilation maillot", 20, 20, "Maillot classique, échancré ou intégral."],
      ["Beauté des mains", 30, 45, "Limage, cuticules, massage, vernis."],
    ],
    addons: [["Épilation sourcils", 12, 15], ["Teinture cils", 18, 15]],
  },
  {
    slug: "onglerie", label: "Prothésiste ongulaire", plural: "Prothésistes ongulaires", group: "beaute", icon: "Hand",
    keywords: ["ongles", "manucure", "pose gel", "semi-permanent", "nail"], modes: ["on_site", "at_home"], prospectQuery: "onglerie",
    seed: [
      ["Pose semi-permanent mains", 35, 45, "Préparation et vernis semi-permanent."],
      ["Pose gel complète", 55, 90, "Capsules ou chablons, gel construction."],
      ["Remplissage gel", 45, 75, "Entretien de la pose gel."],
      ["Pédicure semi-permanent", 40, 60, "Soin des pieds et vernis."],
    ],
    addons: [["Nail art (par ongle)", 3, 5], ["Dépose", 10, 15]],
  },
  {
    slug: "extensions-de-cils", label: "Extensions de cils", plural: "Spécialistes cils & sourcils", group: "beaute", icon: "Eye",
    keywords: ["cils", "rehaussement", "sourcils", "lash", "brow"], modes: ["on_site", "at_home"], prospectQuery: "extension de cils",
    seed: [
      ["Pose cil à cil", 80, 120, "Effet naturel."],
      ["Pose volume russe", 110, 150, "Effet intense."],
      ["Rehaussement de cils", 55, 60, "Courbure et teinture."],
      ["Restructuration sourcils", 25, 30, "Épilation et mise en forme."],
    ],
    addons: [["Teinture sourcils", 12, 10]],
  },
  {
    slug: "maquilleur", label: "Maquilleur", plural: "Maquilleurs", group: "beaute", icon: "Palette",
    keywords: ["maquillage", "mariage", "make-up", "mariée"], modes: ["on_site", "at_home"], prospectQuery: "maquilleuse professionnelle",
    seed: [
      ["Maquillage jour", 40, 45, "Maquillage naturel."],
      ["Maquillage soirée", 55, 60, "Maquillage sophistiqué."],
      ["Essai mariée", 70, 75, "Essai et conseils."],
      ["Maquillage mariée", 120, 90, "Jour J, retouches incluses."],
    ],
  },
  {
    slug: "tatoueur", label: "Tatoueur & pierceur", plural: "Tatoueurs & pierceurs", group: "beaute", icon: "PenTool",
    keywords: ["tatouage", "piercing", "tattoo", "flash"], modes: ["on_site"], prospectQuery: "salon de tatouage",
    seed: [
      ["Consultation projet", 0, 30, "Échange sur votre projet et devis."],
      ["Flash petit format", 80, 60, "Motif disponible, jusqu'à 8 cm."],
      ["Séance tatouage (demi-journée)", 300, 240, "Tarif indicatif, selon projet."],
      ["Piercing oreille", 35, 20, "Bijou titane inclus."],
    ],
  },
  // --- Bien-être -------------------------------------------------------------------------
  {
    slug: "massage", label: "Masseur bien-être", plural: "Masseurs bien-être", group: "bien-etre", icon: "Flower2",
    keywords: ["massage", "relaxation", "détente", "californien", "suédois", "shiatsu"], modes: ["on_site", "at_home"], prospectQuery: "massage bien-être",
    seed: [
      ["Massage relaxant 30 min", 40, 30, "Massage du dos et de la nuque."],
      ["Massage californien 60 min", 70, 60, "Massage enveloppant du corps entier."],
      ["Massage suédois 60 min", 75, 60, "Massage tonique et profond."],
      ["Massage 90 min", 100, 90, "Rituel complet."],
    ],
    addons: [["Huile chaude", 10, 0], ["Pierres chaudes", 15, 15]],
  },
  {
    slug: "spa", label: "Spa & hammam", plural: "Spas & hammams", group: "bien-etre", icon: "Bath",
    keywords: ["spa", "hammam", "sauna", "jacuzzi", "gommage"], modes: ["on_site"], capacity: 6, prospectQuery: "spa hammam",
    seed: [
      ["Accès spa 2 h", 35, 120, "Hammam, sauna et bassin."],
      ["Hammam + gommage", 55, 90, "Accès hammam et gommage au savon noir."],
      ["Accès spa + massage", 95, 180, "Accès 2 h et massage 45 min."],
    ],
  },
  {
    slug: "sophrologue", label: "Sophrologue & relaxation", plural: "Sophrologues", group: "bien-etre", icon: "Wind",
    keywords: ["sophrologie", "méditation", "stress", "relaxation", "hypnose"], modes: ["on_site", "online"], prospectQuery: "sophrologue",
    seed: [
      ["Première séance", 60, 75, "Bilan et première pratique."],
      ["Séance de suivi", 55, 60, "Séance individuelle."],
      ["Séance en visio", 50, 60, "Séance à distance."],
    ],
  },
  // --- Sport -------------------------------------------------------------------------------
  {
    slug: "coach-sportif", label: "Coach sportif", plural: "Coachs sportifs", group: "sport", icon: "Dumbbell",
    keywords: ["coaching", "musculation", "perte de poids", "fitness", "personal trainer"], modes: ["on_site", "at_home", "online"], prospectQuery: "coach sportif",
    seed: [
      ["Séance découverte", 30, 60, "Bilan forme et première séance."],
      ["Séance individuelle", 55, 60, "Programme personnalisé."],
      ["Séance duo", 80, 60, "Séance à deux."],
      ["Coaching en visio", 40, 45, "Séance à distance."],
    ],
  },
  {
    slug: "yoga-pilates", label: "Yoga & Pilates", plural: "Cours de yoga & Pilates", group: "sport", icon: "PersonStanding",
    keywords: ["yoga", "pilates", "vinyasa", "hatha", "méditation"], modes: ["on_site", "online"], capacity: 12, prospectQuery: "studio de yoga",
    seed: [
      ["Cours collectif", 18, 60, "Tous niveaux."],
      ["Cours découverte", 10, 60, "Premier cours."],
      ["Cours particulier", 60, 60, "Séance individuelle."],
    ],
  },
  {
    slug: "cours-de-danse", label: "École de danse", plural: "Écoles de danse", group: "sport", icon: "Activity",
    keywords: ["danse", "salsa", "bachata", "hip-hop", "classique", "mariage"], modes: ["on_site"], capacity: 15, prospectQuery: "école de danse",
    seed: [
      ["Cours collectif", 15, 60, "Tous niveaux."],
      ["Cours particulier", 50, 60, "Séance individuelle."],
      ["Ouverture de bal (3 cours)", 180, 60, "Chorégraphie pour votre mariage."],
    ],
  },
  // --- Auto & moto -------------------------------------------------------------------------
  {
    slug: "garage", label: "Garage & mécanique", plural: "Garages", group: "auto", icon: "Wrench",
    keywords: ["mécanique", "vidange", "révision", "pneus", "freins", "entretien", "garagiste"], modes: ["on_site"],
    variantLabel: "Type de véhicule", variants: VEHICLE, prospectQuery: "garage automobile",
    seed: [
      ["Vidange + filtres", 89, 60, "Huile, filtre à huile, contrôle des niveaux."],
      ["Révision constructeur", 189, 120, "Selon le carnet d'entretien."],
      ["Plaquettes de frein (avant)", 120, 75, "Fourniture et pose."],
      ["Montage 4 pneus", 60, 45, "Montage et équilibrage (pneus non fournis)."],
    ],
    addons: [["Diagnostic électronique", 40, 30], ["Recharge climatisation", 70, 45]],
  },
  {
    slug: "detailing", label: "Lavage & detailing auto", plural: "Spécialistes du lavage & detailing", group: "auto", icon: "Droplets",
    keywords: ["lavage", "nettoyage voiture", "detailing", "polissage", "céramique"], modes: ["on_site", "at_home"],
    variantLabel: "Gabarit du véhicule", variants: VEHICLE, prospectQuery: "detailing automobile",
    seed: [
      ["Lavage intérieur & extérieur", 59, 90, "Lavage main, jantes, aspiration, vitres."],
      ["Nettoyage intérieur complet", 89, 150, "Shampoing tapis, plastiques, cuirs."],
      ["Polissage 1 étape", 189, 240, "Décontamination, polissage, cire."],
      ["Rénovation premium", 349, 420, "Intérieur + polissage + céramique 12 mois."],
    ],
    addons: [["Céramique jantes", 39, 30], ["Désinfection ozone", 29, 30], ["Rénovation optiques", 35, 30]],
  },
  {
    slug: "carrosserie", label: "Carrosserie", plural: "Carrossiers", group: "auto", icon: "CarFront",
    keywords: ["carrossier", "débosselage", "peinture", "pare-brise", "rayure"], modes: ["on_site"], prospectQuery: "carrosserie automobile",
    seed: [
      ["Diagnostic & devis", 0, 30, "Expertise des dommages."],
      ["Débosselage sans peinture", 120, 90, "Petits impacts."],
      ["Réparation rayure", 150, 120, "Retouche peinture localisée."],
    ],
  },
  {
    slug: "auto-ecole", label: "Auto-école", plural: "Auto-écoles", group: "auto", icon: "Car",
    keywords: ["permis", "leçon de conduite", "code", "conduite accompagnée"], modes: ["on_site"], prospectQuery: "auto-école",
    seed: [
      ["Leçon de conduite 1 h", 55, 60, "Leçon avec moniteur."],
      ["Leçon de conduite 2 h", 105, 120, "Leçon longue."],
      ["Évaluation de départ", 50, 60, "Estimation du nombre d'heures."],
    ],
  },
  {
    slug: "moto", label: "Atelier moto & vélo", plural: "Ateliers moto & vélo", group: "auto", icon: "Bike",
    keywords: ["moto", "scooter", "vélo", "réparation vélo", "entretien moto"], modes: ["on_site", "at_home"], prospectQuery: "atelier réparation vélo",
    seed: [
      ["Révision vélo", 59, 60, "Réglages freins, vitesses, graissage."],
      ["Réparation crevaison", 15, 20, "Chambre à air incluse."],
      ["Entretien scooter", 99, 90, "Vidange, bougie, contrôle."],
    ],
  },
  // --- Maison -----------------------------------------------------------------------------
  {
    slug: "plombier", label: "Plombier", plural: "Plombiers", group: "maison", icon: "Droplets",
    keywords: ["plomberie", "fuite", "chauffe-eau", "débouchage", "robinet"], modes: ["at_home"], prospectQuery: "plombier",
    seed: [
      ["Diagnostic / déplacement", 59, 45, "Recherche de panne, devis sur place."],
      ["Débouchage", 120, 60, "Évier, WC ou douche."],
      ["Remplacement mitigeur", 110, 60, "Main d'œuvre (fourniture en sus)."],
    ],
  },
  {
    slug: "electricien", label: "Électricien", plural: "Électriciens", group: "maison", icon: "Zap",
    keywords: ["électricité", "panne", "tableau électrique", "prise", "luminaire"], modes: ["at_home"], prospectQuery: "électricien",
    seed: [
      ["Diagnostic / déplacement", 59, 45, "Recherche de panne, devis sur place."],
      ["Pose de luminaire", 70, 45, "Main d'œuvre."],
      ["Ajout de prise", 90, 60, "Main d'œuvre."],
    ],
  },
  {
    slug: "serrurier", label: "Serrurier", plural: "Serruriers", group: "maison", icon: "KeyRound",
    keywords: ["serrure", "porte claquée", "clé", "blindage"], modes: ["at_home"], prospectQuery: "serrurier",
    seed: [
      ["Ouverture de porte claquée", 90, 30, "Sans dégât, en journée."],
      ["Changement de cylindre", 130, 45, "Cylindre standard inclus."],
      ["Devis blindage", 0, 30, "Visite et devis gratuit."],
    ],
  },
  {
    slug: "menage", label: "Ménage & repassage", plural: "Services de ménage", group: "maison", icon: "Sparkles",
    keywords: ["femme de ménage", "nettoyage", "repassage", "aide ménagère"], modes: ["at_home"],
    variantLabel: "Surface du logement", variants: SURFACE, prospectQuery: "service ménage à domicile",
    seed: [
      ["Ménage régulier 2 h", 50, 120, "Entretien courant du logement."],
      ["Grand ménage", 120, 240, "Nettoyage en profondeur."],
      ["Repassage 2 h", 45, 120, "À domicile."],
    ],
  },
  {
    slug: "jardinier", label: "Jardinier & paysagiste", plural: "Jardiniers", group: "maison", icon: "Leaf",
    keywords: ["jardinage", "tonte", "taille de haie", "élagage", "paysagiste"], modes: ["at_home"], prospectQuery: "jardinier paysagiste",
    seed: [
      ["Tonte de pelouse", 45, 60, "Jusqu'à 300 m²."],
      ["Taille de haie", 90, 120, "Évacuation des déchets incluse."],
      ["Visite & devis aménagement", 0, 45, "Conseils et devis."],
    ],
  },
  {
    slug: "demenageur", label: "Déménageur", plural: "Déménageurs", group: "maison", icon: "Truck",
    keywords: ["déménagement", "transport", "monte-meuble", "cartons"], modes: ["at_home"], prospectQuery: "déménageur",
    seed: [
      ["Visite technique & devis", 0, 45, "Estimation du volume."],
      ["Petit déménagement (2 déménageurs, demi-journée)", 390, 240, "Camion 20 m³ inclus."],
      ["Livraison / transport d'un meuble", 90, 90, "Dans la même ville."],
    ],
  },
  {
    slug: "artisan-renovation", label: "Artisan rénovation", plural: "Artisans rénovation", group: "maison", icon: "Drill",
    keywords: ["peintre", "carreleur", "menuisier", "travaux", "rénovation", "bricolage"], modes: ["at_home"], prospectQuery: "artisan rénovation",
    seed: [
      ["Visite & devis", 0, 60, "Étude de votre projet."],
      ["Petits travaux (demi-journée)", 180, 240, "Montage, fixations, retouches."],
      ["Petits travaux (journée)", 320, 480, "Main d'œuvre."],
    ],
  },
  {
    slug: "depannage-informatique", label: "Dépannage informatique", plural: "Dépanneurs informatiques", group: "maison", icon: "Laptop",
    keywords: ["ordinateur", "réparation téléphone", "wifi", "virus", "smartphone", "écran cassé"], modes: ["on_site", "at_home", "online"], prospectQuery: "dépannage informatique",
    seed: [
      ["Diagnostic", 30, 30, "Analyse de la panne."],
      ["Dépannage à domicile 1 h", 60, 60, "Installation, réseau, virus."],
      ["Assistance à distance", 40, 45, "Prise en main sécurisée."],
      ["Remplacement écran smartphone", 89, 60, "Pièce selon modèle."],
    ],
  },
  // --- Animaux ----------------------------------------------------------------------------
  {
    slug: "toilettage", label: "Toiletteur", plural: "Toiletteurs", group: "animaux", icon: "PawPrint",
    keywords: ["toilettage", "chien", "chat", "tonte", "bain"], modes: ["on_site", "at_home"],
    variantLabel: "Taille de l'animal", variants: PET, prospectQuery: "toilettage chien",
    seed: [
      ["Bain + séchage", 35, 60, "Shampoing adapté, séchage, brossage."],
      ["Toilettage complet", 55, 90, "Bain, tonte ou coupe, griffes, oreilles."],
      ["Coupe des griffes", 12, 15, "Rapide et sans stress."],
    ],
  },
  {
    slug: "educateur-canin", label: "Éducateur canin", plural: "Éducateurs canins", group: "animaux", icon: "Dog",
    keywords: ["éducation chien", "comportementaliste", "dressage", "chiot"], modes: ["on_site", "at_home"], prospectQuery: "éducateur canin",
    seed: [
      ["Bilan comportemental", 60, 90, "Évaluation et conseils."],
      ["Séance d'éducation", 45, 60, "Séance individuelle."],
      ["Cours collectif chiots", 20, 60, "Socialisation."],
    ],
  },
  {
    slug: "pet-sitter", label: "Garde & promenade d'animaux", plural: "Pet-sitters", group: "animaux", icon: "PawPrint",
    keywords: ["garde chien", "promenade", "pension", "pet sitting", "chat"], modes: ["on_site", "at_home"], prospectQuery: "pet sitter",
    seed: [
      ["Promenade 1 h", 18, 60, "Promenade individuelle."],
      ["Visite à domicile", 15, 30, "Repas, litière, câlins."],
      ["Garde à la journée", 30, 480, "En pension familiale."],
    ],
  },
  // --- Cours ------------------------------------------------------------------------------
  {
    slug: "soutien-scolaire", label: "Soutien scolaire", plural: "Professeurs particuliers", group: "cours", icon: "BookOpen",
    keywords: ["cours particuliers", "maths", "aide aux devoirs", "bac", "brevet", "prof"], modes: ["on_site", "at_home", "online"], prospectQuery: "soutien scolaire cours particuliers",
    seed: [
      ["Cours particulier 1 h", 30, 60, "Collège / lycée."],
      ["Cours particulier 1 h 30", 42, 90, "Préparation examens."],
      ["Cours en visio 1 h", 25, 60, "À distance."],
    ],
  },
  {
    slug: "cours-de-musique", label: "Cours de musique", plural: "Professeurs de musique", group: "cours", icon: "Guitar",
    keywords: ["piano", "guitare", "chant", "solfège", "batterie", "violon"], modes: ["on_site", "at_home", "online"], prospectQuery: "cours de musique",
    seed: [
      ["Cours d'essai 30 min", 20, 30, "Découverte."],
      ["Cours individuel 45 min", 35, 45, "Tous niveaux."],
      ["Cours individuel 1 h", 45, 60, "Tous niveaux."],
    ],
  },
  {
    slug: "cours-de-langues", label: "Cours de langues", plural: "Professeurs de langues", group: "cours", icon: "Languages",
    keywords: ["anglais", "espagnol", "français", "FLE", "TOEIC", "conversation"], modes: ["on_site", "online"], prospectQuery: "cours de langues",
    seed: [
      ["Test de niveau", 0, 30, "Évaluation gratuite."],
      ["Cours individuel 1 h", 35, 60, "Programme sur mesure."],
      ["Conversation 30 min", 18, 30, "Pratique orale."],
    ],
  },
  {
    slug: "coach-de-vie", label: "Coach de vie & carrière", plural: "Coachs de vie & carrière", group: "cours", icon: "HeartHandshake",
    keywords: ["coaching", "reconversion", "bilan de compétences", "développement personnel", "orientation"], modes: ["on_site", "online"], prospectQuery: "coach de vie",
    seed: [
      ["Appel découverte", 0, 20, "Premier échange gratuit."],
      ["Séance de coaching", 80, 60, "Séance individuelle."],
      ["Séance CV & entretien", 90, 75, "Préparation candidature."],
    ],
  },
  // --- Conseil ----------------------------------------------------------------------------
  {
    slug: "avocat", label: "Avocat", plural: "Avocats", group: "conseil", icon: "Scale",
    keywords: ["juridique", "droit", "divorce", "licenciement", "litige", "conseil juridique"], modes: ["on_site", "online"], prospectQuery: "cabinet d'avocat",
    seed: [
      ["Consultation juridique 30 min", 90, 30, "Premier avis sur votre situation."],
      ["Consultation 1 h", 160, 60, "Analyse approfondie."],
      ["Consultation en visio", 80, 30, "À distance."],
    ],
  },
  {
    slug: "notaire", label: "Notaire", plural: "Notaires", group: "conseil", icon: "Landmark",
    keywords: ["notarial", "succession", "achat immobilier", "donation", "acte"], modes: ["on_site", "online"], prospectQuery: "office notarial",
    seed: [
      ["Premier rendez-vous", 0, 45, "Présentation du dossier."],
      ["Rendez-vous de signature", 0, 60, "Signature d'acte."],
      ["Conseil patrimonial", 0, 60, "Succession, donation."],
    ],
  },
  {
    slug: "expert-comptable", label: "Expert-comptable", plural: "Experts-comptables", group: "conseil", icon: "Calculator",
    keywords: ["comptabilité", "création d'entreprise", "impôts", "déclaration", "fiscalité"], modes: ["on_site", "online"], prospectQuery: "expert-comptable",
    seed: [
      ["Rendez-vous découverte", 0, 30, "Présentation de vos besoins."],
      ["Aide déclaration de revenus", 80, 60, "Accompagnement personnalisé."],
      ["Création d'entreprise", 150, 90, "Choix du statut, démarches."],
    ],
  },
  {
    slug: "agent-immobilier", label: "Agent immobilier", plural: "Agences immobilières", group: "conseil", icon: "Building",
    keywords: ["visite", "estimation", "vente", "location", "appartement", "maison"], modes: ["on_site", "at_home", "online"], prospectQuery: "agence immobilière",
    seed: [
      ["Estimation de votre bien", 0, 60, "Gratuite et sans engagement."],
      ["Visite d'un bien", 0, 30, "Visite accompagnée."],
      ["Rendez-vous en agence", 0, 30, "Présentation de votre projet."],
    ],
  },
  {
    slug: "assurance-banque", label: "Assurance & banque", plural: "Conseillers assurance & banque", group: "conseil", icon: "Briefcase",
    keywords: ["assurance", "crédit", "prêt immobilier", "courtier", "mutuelle", "conseiller bancaire"], modes: ["on_site", "online"], prospectQuery: "courtier en crédit immobilier",
    seed: [
      ["Bilan assurance", 0, 45, "Analyse de vos contrats."],
      ["Étude de prêt immobilier", 0, 60, "Simulation et conseil."],
      ["Rendez-vous en visio", 0, 30, "À distance."],
    ],
  },
  // --- Loisirs ----------------------------------------------------------------------------
  {
    slug: "restaurant", label: "Restaurant", plural: "Restaurants", group: "loisirs", icon: "Utensils",
    keywords: ["table", "dîner", "déjeuner", "brunch", "réservation", "bistrot"], modes: ["on_site"],
    variantLabel: "Nombre de personnes", variants: PARTY, capacity: 10, prospectQuery: "restaurant",
    seed: [
      ["Réservation déjeuner", 0, 90, "Table pour le déjeuner."],
      ["Réservation dîner", 0, 120, "Table pour le dîner."],
      ["Brunch", 0, 120, "Le week-end."],
    ],
  },
  {
    slug: "escape-game", label: "Escape game & activités", plural: "Escape games & activités", group: "loisirs", icon: "Puzzle",
    keywords: ["escape", "laser game", "bowling", "karting", "réalité virtuelle", "anniversaire"], modes: ["on_site"],
    variantLabel: "Nombre de joueurs", variants: GROUP_SIZE, prospectQuery: "escape game",
    seed: [
      ["Salle d'escape game 60 min", 60, 75, "Briefing inclus."],
      ["Réalité virtuelle 30 min", 25, 30, "Par casque."],
      ["Formule anniversaire", 180, 150, "Jeu + goûter."],
    ],
  },
  {
    slug: "photographe", label: "Photographe", plural: "Photographes", group: "loisirs", icon: "Camera",
    keywords: ["shooting", "portrait", "photo d'identité", "mariage", "famille", "studio photo"], modes: ["on_site", "at_home"], prospectQuery: "photographe",
    seed: [
      ["Photos d'identité", 15, 15, "Conformes aux normes."],
      ["Shooting portrait 1 h", 120, 60, "10 photos retouchées."],
      ["Shooting famille", 180, 90, "En studio ou en extérieur."],
    ],
  },
  {
    slug: "atelier-creatif", label: "Atelier créatif & dégustation", plural: "Ateliers créatifs", group: "loisirs", icon: "ChefHat",
    keywords: ["cours de cuisine", "poterie", "œnologie", "atelier", "céramique", "pâtisserie"], modes: ["on_site"], capacity: 10, prospectQuery: "atelier poterie cours de cuisine",
    seed: [
      ["Atelier découverte 2 h", 45, 120, "Matériel inclus."],
      ["Atelier duo", 85, 120, "Pour deux personnes."],
      ["Privatisation (groupe)", 400, 180, "Jusqu'à 10 personnes."],
    ],
  },
  // --- Services du quotidien --------------------------------------------------------------
  {
    slug: "retouches-couture", label: "Retouches & couture", plural: "Retoucheurs", group: "services", icon: "Shirt",
    keywords: ["retouche", "ourlet", "couturière", "cordonnier", "pressing"], modes: ["on_site"], prospectQuery: "retouches couture",
    seed: [
      ["Ourlet pantalon", 12, 15, "Dépôt et essayage."],
      ["Retouche robe / veste", 30, 20, "Essayage et prise de mesures."],
      ["Création sur mesure (rendez-vous)", 0, 45, "Échange et devis."],
    ],
  },
  {
    slug: "conciergerie", label: "Services administratifs", plural: "Services administratifs", group: "services", icon: "ClipboardList",
    keywords: ["écrivain public", "démarches", "carte grise", "aide administrative", "traduction"], modes: ["on_site", "online"], prospectQuery: "aide administrative écrivain public",
    seed: [
      ["Aide aux démarches 30 min", 25, 30, "CAF, impôts, retraite…"],
      ["Démarche carte grise", 30, 30, "Prise en charge complète."],
      ["Traduction (devis)", 0, 20, "Échange et devis."],
    ],
  },
];

export const CATEGORY_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c]));

export function getCategory(slug: string | null | undefined): CategoryDef | null {
  return slug ? CATEGORY_BY_SLUG.get(slug) ?? null : null;
}

export function categoriesOfGroup(group: GroupSlug): CategoryDef[] {
  return CATEGORIES.filter((c) => c.group === group);
}

/** Catégories mises en avant sur l'accueil. */
export const FEATURED_CATEGORIES = ["coiffeur", "barbier", "institut-de-beaute", "massage", "coach-sportif", "garage", "detailing", "restaurant", "toilettage", "soutien-scolaire", "avocat", "plombier"];

export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Recherche locale (sans base) des catégories correspondant à une saisie : autocomplétion. */
export function matchCategories(query: string, limit = 5): CategoryDef[] {
  const q = normalizeText(query);
  if (q.length < 2) return [];
  const scored = CATEGORIES.map((c) => {
    const label = normalizeText(c.label);
    const plural = normalizeText(c.plural);
    let score = 0;
    if (label.startsWith(q) || plural.startsWith(q)) score = 3;
    else if (label.includes(q) || plural.includes(q)) score = 2;
    else if (c.keywords.some((k) => normalizeText(k).includes(q))) score = 1;
    return { c, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.c);
}
