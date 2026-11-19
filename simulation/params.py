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
    "Agence réseaux sociaux (community management)",
    "Montage vidéo / contenus UGC pour marques",
    "Cours particuliers / soutien scolaire",
    "Services à domicile (ménage, jardinage, bricolage)",
    "Conciergerie Airbnb",
    "Réparation de smartphones / PC",
    "Coaching sportif (BPJEPS)",
    "Photo / vidéo de mariages et d'événements",
    "Organisation de soirées / événements",
    "Mandataire immobilier",
    "Artisan du bâtiment (formation puis entreprise)",
    "Food truck / restauration",
    "Jeux vidéo indé / jeux mobiles",
    "Outils IA pour développeurs",
    "Startup cleantech / énergie",
    "Startup santé / medtech",
    "Startup défense / dual-use",
    "Startup edtech",
    "Startup hardware / robotique / drones",
    "Achat-revente (Vinted, Leboncoin, sneakers)",
    "Marque e-commerce / Amazon FBA",
    "Print on demand / produits numériques",
    "Achat-revente de voitures d'occasion",
    "Streaming / gaming (Twitch)",
    "Sites de niche SEO / affiliation",
    "Newsletter payante",
    "Musique / artiste",
    "Paris sportifs",
    "Poker en ligne",
    "Memecoins / NFT",
    "Alternance",
    "CDI / fonction publique",
    "Livreur / VTC",
    "Bourse long terme (ETF)",
    "Immobilier locatif",
]
ENGINES_SHORT = [
    "Salariat tech", "Freelance", "Agence IA", "Closer", "Micro-SaaS",
    "Startup IA verticale", "App IA B2C", "Marketplace", "Fintech", "Deeptech",
    "E-commerce", "Contenu", "Info-produits", "Trading", "Fraude",
    "Agence réseaux sociaux", "Montage vidéo / UGC", "Cours particuliers", "Services à domicile",
    "Conciergerie Airbnb", "Réparation smartphones", "Coaching sportif", "Photo / vidéo mariages",
    "Soirées / événements", "Mandataire immobilier", "Artisan du bâtiment", "Food truck",
    "Jeux vidéo", "Outils IA dev", "Cleantech", "Medtech", "Défense", "Edtech", "Hardware / robotique",
    "Achat-revente", "Marque e-commerce", "Print on demand", "Voitures d'occasion",
    "Streaming", "Sites SEO", "Newsletter", "Musique",
    "Paris sportifs", "Poker", "Memecoins / NFT",
    "Alternance", "CDI", "Livreur / VTC", "Bourse (ETF)", "Immobilier locatif",
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
    "keep": ["non (on arrête l'activité de services)", "oui (les services financent le produit)"],
    "base": ["études courtes (3 ans)", "études longues (5 ans, école)", "petit job à temps partiel",
             "job à temps plein", "rien à côté (chez les parents)"],
    "hstart": ["5 h", "10 h", "15 h", "20 h"],
    "ramp": ["dès 500 €/mois", "dès 1 000 €/mois", "dès 2 000 €/mois", "dès 3 000 €/mois", "dès 5 000 €/mois",
             "jamais (reste à temps partiel)"],
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
    [250, 0.25, 300,     0.050, 1.0, 1, 59,    6.0,  0.045, 0.035, 0.85, 6e6,  3,  2,  6,  0.15, 6,  0, 1],   # micro-SaaS
    [450, 0.35, 1500,    0.009, 1.6, 1, 450,   0.6,  0.055, 0.020, 0.72, -1,   4,  14, 60, 1.3,  10, 1, 0],   # IA verticale
    [350, 0.30, 2000,    0.015, 0.3, 0, 8,     120,  0.12, 0.100, 0.65, 3e9,   2,  9,  35, 0.9,  4,  0, 2],   # app B2C
    [500, 0.30, 2000,    0.020, 1.0, 0, 12,    30,   0.09, 0.050, 0.80, -2,    3,  10, 40, 0.8,  6,  1, 2],   # marketplace
    [1500, 0.50, 250e3,  0.020, 1.2, 0, 6,     80,   0.09, 0.030, 0.45, 5e9,   3,  8,  30, 0.9,  8,  0, 2],   # fintech
    [4000, 0.85, 2e6,    0.020, 0.5, 1, 15000, 0.04, 0.10, 0.015, 0.55, 10e9,  6,  15, 80, 1.4,  12, 1, 0],   # deeptech
] + [_Z] * 17 + [
    [600, 0.35, 1000,    0.010, 0.3, 0, 4,     200,  0.15, 0.120, 0.70, 2e9,   2,  6,  20, 0.6,  3,  0, 2],   # jeux vidéo
    [400, 0.50, 1000,    0.012, 0.6, 1, 40,    4.0,  0.08, 0.050, 0.60, 5e9,   4,  14, 60, 1.4,  6,  0, 1],   # outils IA dev
    [1500, 0.50, 50e3,   0.012, 1.2, 1, 2000,  0.2,  0.025, 0.010, 0.35, 4e9,  3,  6,  25, 1.0,  12, 1, 0],   # cleantech
    [2000, 0.50, 100e3,  0.012, 1.5, 1, 800,   0.3,  0.025, 0.015, 0.70, 4e9,  4,  8,  30, 1.2,  12, 1, 0],   # medtech
    [3000, 0.70, 500e3,  0.006, 1.5, 1, 12000, 0.01, 0.02, 0.010, 0.40, 2e9,   4,  6,  20, 1.2,  12, 1, 0],   # défense
    [400, 0.30, 1000,    0.020, 0.8, 0, 12,    80,   0.08, 0.080, 0.75, 1.5e9, 2,  6,  20, 0.6,  5,  0, 2],   # edtech
    [2500, 0.60, 80e3,   0.012, 1.0, 1, 1500,  0.2,  0.025, 0.020, 0.40, 3e9,  3,  6,  25, 1.1,  12, 1, 0],   # hardware
] + [_Z] * 16, dtype=np.float64)
assert ENG.shape == (50, 19)

# --------------------------------------------------------------------------
# Calibrage sur les données réelles (colonne 19 de ENG, P_CAL dans model.py).
# Facteur de difficulté du marché par moteur : il multiplie la demande (clients, acheteurs, leads,
# marge, gains) pour que la meilleure version de chaque activité, seule, atteigne 10 k€/mois
# (3 mois de suite) dans 10 ans avec une probabilité proche des données publiques
# (enquêtes créateurs, Insee non-salariés et micro-entrepreneurs, Chague et al. 2019…).
# Cibles et sources : calibrate.py et README. 1.0 = pas de correction.
CALIBRAGE = {1: 0.5428, 2: 0.4442, 3: 0.6084, 4: 0.3916, 5: 0.5458, 10: 0.1191, 11: 0.4377, 12: 0.3582, 13: 0.6198, 15: 0.2822, 19: 0.389, 24: 0.1511, 25: 0.4675, 35: 0.7838, 38: 0.7025, 39: 0.5408, 40: 0.4194, 41: 0.2522, 42: 0.6385, 43: 0.5163, 44: 0.5939}
CAL = np.ones(50)
for _e, _k in CALIBRAGE.items():
    CAL[_e] = _k
ENG = np.hstack([ENG, CAL[:, None]])
assert ENG.shape == (50, 20)

# Monde « nominal » : multiplicateurs (voir model.py, W_*). W_TRADE est additif.
WORLD_NOMINAL = np.array([1.0] * 12 + [0.0, 1.0, 1.0, 1.0, 0.0], dtype=np.float64)
WORLD_NAMES = [
    "conversion commerciale (services)", "probabilité de PMF", "croissance organique",
    "facilité de lever des fonds", "multiples de valorisation", "attrition clients",
    "viralité du contenu", "revenus de closer", "chance e-commerce", "risque de burnout",
    "baisse des prix due à l'IA", "poids de la connaissance métier",
    "alpha du trader (additif)", "taux de détection de la fraude",
    "marges du commerce / revente", "monétisation de l'audience", "avantage aux jeux d'argent (additif)",
]
