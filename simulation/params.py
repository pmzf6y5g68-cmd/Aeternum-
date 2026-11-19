"""
Hypothèses du modèle (toutes modifiables).

Chaque chiffre est une estimation basée sur des données publiques (sources dans
README.md) ou sur mon jugement quand aucune donnée fiable n'existe. Le modèle
n'est PAS la réalité : l'algorithme génétique optimise à l'intérieur de ces
hypothèses. C'est pour ça que robustness.py relance tout dans des « mondes »
où ces hypothèses sont perturbées de ±30 à 50 %.
"""
import numpy as np

# --------------------------------------------------------------------------
# Moteurs de revenus (les « espèces » de l'évolution)
# --------------------------------------------------------------------------
ENGINES = [
    "Salarié dans une startup tech/IA",
    "Freelance IA / no-code (Malt, Upwork)",
    "Agence d'automatisation IA (B2B)",
    "Closer / commercial à la commission",
    "Micro-SaaS de niche (bootstrappé)",
    "Startup IA verticale (agents IA pour un métier)",
    "App IA grand public (B2C)",
    "Marketplace / plateforme",
    "Startup fintech",
    "Labo IA deeptech (modèles, infra)",
    "E-commerce / dropshipping",
    "Créateur de contenu",
    "Formations / info-produits",
    "Trading / crypto (spéculation)",
    "Arnaques / fraude (témoin, voir README)",
]
ENGINES_SHORT = [
    "Salariat", "Freelance", "Agence IA", "Closer", "Micro-SaaS",
    "Startup IA verticale", "App IA B2C", "Marketplace", "Fintech", "Deeptech",
    "E-commerce", "Contenu", "Info-produits", "Trading", "Fraude",
]

SECTORS = [
    "Expertise comptable", "Juridique (avocats, notaires)", "Santé (cabinets, cliniques)",
    "Immobilier", "BTP / artisans / services terrain", "E-commerce / retail",
    "RH / recrutement", "Restauration / hôtellerie", "Assurance / courtage",
    "Logistique / transport", "Industrie / PME manufacturières",
    "Agences marketing", "Éducation / formation", "Gestion de patrimoine / finance",
]

CHANNELS = [
    "Prospection directe (mails, LinkedIn, appels)",
    "Contenu / marque personnelle",
    "Publicité payante",
    "Partenariats / apporteurs d'affaires",
    "Marketplaces / app stores",
    "Réseau / événements / communautés",
]

GENE_LABELS = {
    "thr": ["jamais", "2 k€/mois", "4 k€/mois", "6 k€/mois", "10 k€/mois", "15 k€/mois", "25 k€/mois", "50 k€/mois"],
    "dl": ["3 mois", "6 mois", "9 mois", "12 mois", "18 mois", "24 mois", "36 mois", "48 mois", "jamais"],
    "content": ["0 %", "10 %", "20 %", "35 %"],
    "price": ["bas", "moyen", "haut", "premium"],
    "hours": ["35 h", "45 h", "55 h", "65 h", "75 h", "90 h"],
    "learn": ["0 %", "10 %", "25 %", "50 %"],
    "reinv": ["0 %", "25 %", "50 %", "80 %"],
    "fund": ["autofinancé", "accélérateur puis VC", "levée VC (seed)", "VC agressif"],
    "raise": ["dès le départ", "100 k€ ARR", "400 k€ ARR", "1,5 M€ ARR"],
    "geo": ["France uniquement", "France → Europe", "France → Europe → USA", "Mondial dès le jour 1"],
    "cof": ["jamais", "au lancement du produit", "dès le jour 1"],
    "niche": ["niche étroite (puis élargir)", "marché large"],
    "keep": ["non (on vend/arrête l'agence)", "oui (l'agence finance le produit)"],
}

# --------------------------------------------------------------------------
# Secteurs : [wtp, reply, maturity, disruption, regulation, competition, tam, cpl, heat]
#  wtp         multiplicateur de prix accepté
#  reply       taux de réponse de base à une prospection directe
#  maturity    maturité numérique (adoption)
#  disruption  valeur que l'IA peut créer (part du travail automatisable)
#  regulation  friction réglementaire (RGPD santé, ACPR, AMF...)
#  competition intensité concurrentielle IA en 2026
#  tam         plafond d'ARR mondial pour un leader IA vertical (€)
#  cpl         coût d'un rendez-vous qualifié en pub B2B (€)
#  heat        appétit des VC pour le secteur
# --------------------------------------------------------------------------
SEC = np.array([
    [1.2, 0.018, 0.55, 0.85, 0.30, 0.75, 3.0e9, 140, 1.1],   # comptabilité
    [1.5, 0.012, 0.40, 0.95, 0.40, 0.85, 4.0e9, 180, 1.4],   # juridique
    [1.2, 0.009, 0.35, 0.85, 0.80, 0.70, 5.0e9, 170, 1.3],   # santé
    [1.1, 0.022, 0.60, 0.75, 0.20, 0.65, 2.5e9, 110, 1.1],   # immobilier
    [0.9, 0.017, 0.25, 0.70, 0.15, 0.35, 3.0e9, 90, 1.0],    # BTP / services terrain
    [0.8, 0.026, 0.85, 0.65, 0.10, 0.90, 2.0e9, 80, 0.8],    # e-commerce / retail
    [1.1, 0.022, 0.70, 0.80, 0.30, 0.80, 2.0e9, 120, 1.0],   # RH
    [0.6, 0.015, 0.30, 0.45, 0.20, 0.50, 1.0e9, 70, 0.6],    # restauration
    [1.4, 0.013, 0.40, 0.85, 0.60, 0.60, 3.5e9, 160, 1.2],   # assurance
    [1.2, 0.015, 0.35, 0.75, 0.30, 0.50, 3.0e9, 130, 1.0],   # logistique
    [1.4, 0.011, 0.35, 0.70, 0.30, 0.45, 3.5e9, 170, 1.0],   # industrie
    [0.8, 0.025, 0.90, 0.80, 0.10, 0.95, 1.2e9, 70, 0.7],    # agences marketing
    [0.7, 0.022, 0.55, 0.70, 0.30, 0.70, 1.5e9, 90, 0.8],    # éducation
    [1.5, 0.013, 0.45, 0.80, 0.70, 0.60, 2.5e9, 170, 1.1],   # patrimoine / finance
], dtype=np.float64)

# --------------------------------------------------------------------------
# Paramètres des moteurs « produit » (lignes 4 à 9 ; les autres sont codés
# directement dans model.py). Colonnes :
#  build    heures de construction du MVP
#  mintech  niveau technique minimum
#  capital  capital requis au lancement (€) — licences fintech, calcul deeptech
#  pmf      probabilité mensuelle de trouver le product-market fit (conditions idéales)
#  insexp   poids de la connaissance métier dans le PMF
#  b2b      1 = vend à des entreprises
#  arpu     revenu mensuel par client (€, prix moyen)
#  acq      clients acquis pour 100 h de vente/marketing
#  gorg     croissance organique mensuelle après PMF (bouche-à-oreille, expansion)
#  churn    attrition mensuelle
#  margin   marge brute
#  ceil     plafond d'ARR (−1 = TAM du secteur, −2 = 70 % du TAM)
#  m0, m1, mcap  multiple d'ARR = m0 + m1 × croissance annuelle, plafonné
#  vchot    attractivité pour les VC
#  payback  mois pour rembourser le coût d'acquisition (pub)
#  moat     1 = le multiple dépend des données / workflows propriétaires
#  elast    famille d'élasticité-prix (0 B2B IA, 1 micro-SaaS, 2 B2C)
# --------------------------------------------------------------------------
_Z = [0.0] * 19
ENG = np.array([
    _Z, _Z, _Z, _Z,
    #  build mint  capital  pmf   insexp b2b arpu  acq    gorg  churn  marg  ceil   m0  m1  mcap vchot payb moat el
    [250, 0.25, 300,     0.090, 1.0, 1, 59,    12.0, 0.06, 0.035, 0.85, 6e6,   3,  2,  6,  0.15, 6,  0, 1],   # micro-SaaS
    [450, 0.35, 1500,    0.015, 1.6, 1, 450,   0.9,  0.07, 0.020, 0.72, -1,    4,  14, 60, 1.3,  10, 1, 0],   # IA verticale
    [350, 0.30, 2000,    0.015, 0.3, 0, 8,     120,  0.12, 0.100, 0.65, 3e9,   2,  9,  35, 0.9,  4,  0, 2],   # app B2C
    [500, 0.30, 2000,    0.020, 1.0, 0, 12,    30,   0.09, 0.050, 0.80, -2,    3,  10, 40, 0.8,  6,  1, 2],   # marketplace
    [1500, 0.50, 250e3,  0.020, 1.2, 0, 6,     80,   0.09, 0.030, 0.45, 5e9,   3,  8,  30, 0.9,  8,  0, 2],   # fintech
    [4000, 0.85, 2e6,    0.020, 0.5, 1, 15000, 0.04, 0.10, 0.015, 0.55, 10e9,  6,  15, 80, 1.4,  12, 1, 0],   # deeptech
    _Z, _Z, _Z, _Z, _Z,
], dtype=np.float64)

# Monde « nominal » : multiplicateurs (voir model.py, W_*). W_TRADE est additif.
WORLD_NOMINAL = np.array([1.0] * 12 + [0.0, 1.0], dtype=np.float64)
WORLD_NAMES = [
    "conversion commerciale (services)", "probabilité de PMF", "croissance organique",
    "facilité de lever des fonds", "multiples de valorisation", "attrition clients",
    "viralité du contenu", "revenus de closer", "chance e-commerce", "risque de burnout",
    "baisse des prix due à l'IA", "poids de la connaissance métier",
    "alpha du trader (additif)", "taux de détection de la fraude",
]
