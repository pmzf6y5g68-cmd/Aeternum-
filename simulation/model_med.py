"""
Simulateur Monte-Carlo PERSONNALISÉ : étudiant(e) en médecine de 18 ans près de Paris, 1 500 € d'épargne,
quelques bases en code. Horizon 15 ans. Activité de base 0/1 = médecine (avec ou sans année de césure possible).

Profil de départ : 18 ans, seul, sans expérience ni réseau, en France, quelques centaines à quelques milliers
d'euros d'épargne. Au début, peu de temps pour le projet (5 à 20 h/semaine) à côté d'une activité de base
(études, petit job, job à temps plein ou rien) ; on passe à temps plein seulement quand le projet rapporte.

Une stratégie = un génome de 23 gènes : jusqu'à 3 phases parmi 50 moteurs de revenus, leurs déclencheurs,
le secteur, le canal, le prix, les heures, l'activité de base, le seuil de passage à temps plein, etc.
"""
import math
import numpy as np
from numba import njit, prange

T_MONTHS = 180  # version personnalisée : 15 ans (de 18 à 33 ans)
KU = 18  # tirages uniformes / mois
KZ = 8   # tirages gaussiens / mois
KI = 12  # tirages initiaux / vie
NM = 21  # métriques / vie

(G_E1, G_E2, G_E3, G_THR12, G_DL12, G_THR23, G_DL23, G_SECTOR, G_CHANNEL,
 G_CONTENT, G_PRICE, G_HOURS, G_LEARN, G_REINV, G_FUND, G_RAISE, G_GEO,
 G_COF, G_NICHE, G_KEEP, G_BASE, G_HSTART, G_RAMP) = range(23)
NG = 23
NE = 50
GENE_CARD = np.array([NE, NE, NE, 8, 9, 8, 9, 14, 6, 4, 4, 6, 4, 4, 4, 4, 4, 3, 2, 2, 5, 4, 6], dtype=np.int64)
GENE_NAMES = ["moteur 1", "moteur 2", "moteur 3", "seuil 1→2", "délai 1→2", "seuil 2→3",
              "délai 2→3", "secteur", "canal", "part contenu", "prix", "heures/sem à temps plein",
              "apprentissage", "réinvestissement", "financement", "déclencheur levée",
              "géographie", "associé", "niche", "garder l'activité de services",
              "activité de base", "heures/sem au début", "passage à temps plein"]

# ---- moteurs historiques (indices inchangés)
(E_JOB, E_FREE, E_AGENCY, E_CLOSER, E_MICRO, E_VERTAI, E_CONSUMER, E_MARKET,
 E_FINTECH, E_DEEPTECH, E_ECOM, E_CONTENT, E_INFO, E_TRADING, E_FRAUD) = range(15)
E_ETF = 48
E_IMMO = 49

# ---- familles de moteurs
(F_JOB, F_FREE, F_AGENCY, F_CLOSER, F_PROD, F_ECOM, F_CONTENT, F_INFO, F_TRADING, F_FRAUD,
 F_SVC, F_FLIP, F_AUD, F_SPEC, F_SAL, F_INV) = range(16)
FAMILY = np.array([F_JOB, F_FREE, F_AGENCY, F_CLOSER, F_PROD, F_PROD, F_PROD, F_PROD, F_PROD, F_PROD,
                   F_ECOM, F_CONTENT, F_INFO, F_TRADING, F_FRAUD]
                  + [F_SVC] * 12 + [F_PROD] * 7 + [F_FLIP] * 4 + [F_AUD] * 4 + [F_SPEC] * 3 + [F_SAL] * 3
                  + [F_INV] * 2, dtype=np.int64)

THR = np.array([1e18, 2000., 4000., 6000., 10000., 15000., 25000., 50000.])
DLN = np.array([3., 6., 9., 12., 18., 24., 36., 48., 1e9])
CONTENT_SH = np.array([0.0, 0.10, 0.20, 0.35])
HOURS = np.array([35., 45., 55., 65., 75., 90.])
LEARN = np.array([0.0, 0.10, 0.25, 0.50])
REINV = np.array([0.0, 0.25, 0.50, 0.80])
RAISE_TRIG = np.array([0.0, 100e3, 400e3, 1.5e6])
HSTART = np.array([5., 10., 15., 20.])
RAMP_THR = np.array([500., 1000., 2000., 3000., 5000., 1e18])

(W_SERV, W_PMF, W_GROWTH, W_VC, W_MULT, W_CHURN, W_CONTENT, W_CLOSER,
 W_ECOM, W_BURN, W_COMMOD, W_INSEXP, W_TRADE, W_FRAUD, W_FLIP, W_AUD, W_SPEC) = range(17)
NW = 17

(M_S, M_H6, M_H12, M_H24, M_H60, M_H120, M_DUR, M_PUNI, M_LOGW, M_CAT,
 M_QUIT, M_VAL, M_I12, M_I24, M_I60, M_SEED, M_PUNI_SEED, M_T10K, M_V100M,
 M_PRODALIVE, M_DUR2) = range(21)
METRIC_NAMES = ["score_vitesse", "p10k_6m", "p10k_12m", "p10k_24m", "p10k_60m", "p10k_120m",
                "p_durable_60m", "p_licorne", "log10_patrimoine", "p_catastrophe", "p_abandon",
                "valo_10ans", "revenu_m12", "revenu_m24", "revenu_m60", "p_levee_seed",
                "p_licorne_x_seed", "mois_10k", "p_valo_100M", "p_produit_vivant", "part_temps_10k_3_10ans"]

(P_BUILD, P_MINTECH, P_CAPITAL, P_PMF, P_INSEXP, P_B2B, P_ARPU, P_ACQ, P_GORG,
 P_CHURN, P_MARGIN, P_CEIL, P_M0, P_M1, P_MCAP, P_VCHOT, P_PAYBACK, P_MOAT, P_ELAST) = range(19)

ELAST = np.array([[1.3, 1.0, 0.55, 0.25],
                  [1.4, 1.0, 0.50, 0.20],
                  [1.6, 1.0, 0.40, 0.15]])
TIER_CHURN = np.array([1.3, 1.0, 0.9, 0.85])
TIER_PRICE_PROD = np.array([[0.6, 1.0, 1.5, 2.2],    # B2B IA
                            [0.5, 1.0, 2.0, 3.0],    # micro-SaaS
                            [0.6, 1.0, 1.6, 2.5]])   # B2C
AG_SETUP = np.array([900., 2500., 4000., 8000.])
AG_RET = np.array([250., 600., 1000., 2000.])
AG_SCOPE = np.array([0.5, 1.0, 1.7, 3.0])
AG_TCLOSE = np.array([1.3, 1.0, 0.65, 0.38])
FR_TJM = np.array([0.8, 1.0, 1.2, 1.4])
FR_TWIN = np.array([1.4, 1.0, 0.65, 0.4])
CL_COMM = np.array([150., 300., 500., 800.])
CL_TCLOSE = np.array([1.35, 1.0, 0.70, 0.5])
IP_PRICE = np.array([47., 297., 997., 2997.])
IP_CONV = np.array([0.004, 0.0015, 0.0006, 0.00025])
TR_LEV = np.array([1., 2., 5., 10.])
SALARY = np.array([0., 2500., 4000., 6000., 8000., 11000.])
CHP = np.array([[0.15, 1.0], [0.9, 0.8], [1.0, 0.5], [0.4, 1.1], [1.1, 0.6], [0.6, 0.8]])
GEO_CEIL = np.array([0.07, 0.28, 1.0])
GEO_VC = np.array([0.8, 0.9, 1.15])
GEO_MULT = np.array([0.8, 0.9, 1.1])
GEO_ARPU = np.array([1.0, 1.05, 1.35])
LOG_UNICORN = math.log10(0.925e9)  # 1 milliard de dollars ≈ 0,925 milliard d'euros

# ---------------------------------------------------------------------------------------------------
# Services génériques (moteurs 15 à 26)
(SV_PRICE, SV_HUNIT, SV_RECSH, SV_RECP, SV_RECH, SV_LEAD, SV_CLOSE, SV_SKILL, SV_GATE, SV_CAP, SV_DELEG,
 SV_LABOR, SV_POOL, SV_COMMOD, SV_YOUTH, SV_INS, SV_CYCLE, SV_RECCH, SV_SALE, SV_ONLINE, SV_COSTR, SV_WTP,
 SV_NATSEC, SV_GATEINC, SV_MAXU, SV_RISK, SV_HOURLY, SV_SKFLOOR, SV_MAXOWN) = range(29)
NSV = 29
_S = np.zeros((NE, NSV))
#               price hunit recsh recp  rech  lead  close skill gate cap    deleg labor pool    commod youth ins  cycle recch sale online costr wtp natsec gateinc maxu risk
_S[15] = [600, 14, 0.60, 450, 7, 0.035, 0.075, 1, 0, 100, 1, 0.62, 60000, 0.004, 0.30, 0.30, 0, 0.070, 0.8, 1, 0.05, 1, -1, 0, 30, 0.1, 0, 0.2, 999]  # agence réseaux sociaux
_S[16] = [180, 5, 0.35, 650, 20, 0.07, 0.1125, 0, 1, 400, 1, 0.68, 100000, 0.008, 0.05, 0.05, 0, 0.080, 0.3, 1, 0.03, 0, -1, 0, 60, 0.1, 0, 0.2, 999]  # montage vidéo / UGC
_S[17] = [30, 1.3, 0.85, 125, 5.5, 0.18, 0.2625, 0, 0, 0, 1, 0.82, 25000, 0.002, 0.0, 0.0, 0, 0.100, 0.5, 1, 0.05, 0, -1, 0, 80, 0.05, 1, 0.5, 110]  # cours particuliers
_S[18] = [120, 4.5, 0.55, 420, 16, 0.12, 0.225, 2, 0, 600, 1, 0.85, 50000, 0.0, 0.15, 0.10, 0, 0.040, 1.0, 0, 0.05, 0, 4, 0, 120, 0.05, 1, 0.4, 160]  # services à domicile
_S[19] = [150, 6, 0.95, 300, 8, 0.06, 0.12, 1, 0, 400, 1, 0.65, 12000, 0.004, 0.25, 0.20, 1, 0.035, 1.5, 0, 0.06, 0, 3, 0, 15, 0.1, 0, 0.3, 999]  # conciergerie Airbnb
_S[20] = [70, 1.2, 0.0, 0, 0, 0.35, 0.3375, 0, 1, 1500, 1, 0.72, 40000, 0.002, 0.05, 0.0, 0, 0.0, 0.8, 0, 0.35, 0, -1, 0, 250, 0.1, 1, 0.3, 170]  # réparation smartphones / PC
_S[21] = [50, 1.3, 0.50, 240, 6, 0.10, 0.1875, 2, 10, 300, 1, 0.8, 30000, 0.002, 0.05, 0.0, 0, 0.060, 0.6, 1, 0.05, 0, -1, 650, 20, 0.05, 1, 0.4, 130]  # coaching sportif (BPJEPS)
_S[22] = [1500, 35, 0.0, 0, 0, 0.02, 0.15, 0, 2, 3000, 1, 0.62, 20000, 0.003, 0.15, 0.0, 4, 0.0, 0.5, 0, 0.10, 0, -1, 0, 8, 0.15, 1, 0.3, 150]  # photo / vidéo de mariage
_S[23] = [3500, 45, 0.0, 0, 0, 0.015, 0.375, 1, 0, 1500, 1, 0.5, 8000, 0.0, 0.0, 0.0, 1, 0.0, 0.3, 0, 0.68, 0, -1, 0, 6, 0.5, 1, 0.3, 150]  # organisation de soirées
_S[24] = [5000, 25, 0.0, 0, 0, 0.008, 0.2625, 1, 1, 1200, 0, 0.0, 30000, 0.0, 0.40, 0.30, 4, 0.0, 0.0, 0, 0.15, 0, 3, 0, 4, 0.15, 0, 0.2, 999]  # mandataire immobilier
_S[25] = [1800, 45, 0.10, 150, 2, 0.09, 0.2625, 2, 18, 5000, 1, 0.8, 100000, -0.001, 0.20, 0.60, 1, 0.030, 1.0, 0, 0.30, 0, 4, 900, 25, 0.15, 0, 0.4, 999]  # artisan du bâtiment
_S[26] = [900, 11, 0.0, 0, 0, 0.30, 0.6, 2, 2, 35000, 1, 0.35, 5000, 0.0, 0.05, 0.10, 0, 0.0, 1.5, 0, 0.55, 0, -1, 0, 26, 0.2, 1, 0.3, 200]  # food truck / restauration
SVC = _S
TIER_PRICE_SVC = np.array([[0.7, 1.0, 1.35, 1.8],      # services au projet
                           [0.8, 1.0, 1.2, 1.4]])      # services facturés à l'heure (marché local, prix plafonnés)
TIER_CLOSE_SVC = np.array([[1.3, 1.0, 0.7, 0.45],
                           [1.2, 1.0, 0.65, 0.35]])
CHS = np.array([1.0, 0.5, 0.0, 0.8, 1.1, 1.0])

# Commerce / revente (moteurs 34 à 37)
(FL_CAPMIN, FL_MARGIN, FL_TURNS, FL_HPK, FL_SD, FL_LOSSP, FL_LOSSF, FL_SAT, FL_LABK, FL_FIXED, FL_SALE,
 FL_COMMOD) = range(12)
NFL = 12
_F = np.zeros((NE, NFL))
_F[34] = [100, 0.45, 1.2, 22, 0.15, 0.01, 0.20, 15000, 120, 15, 0.3, 0.002]       # achat-revente (Vinted, Leboncoin)
_F[35] = [3000, 0.28, 0.6, 2.5, 0.25, 0.02, 0.35, 150000, 30, 300, 2.5, 0.002]    # marque e-commerce / Amazon FBA
_F[36] = [50, 0.30, 4.0, 6, 0.30, 0.01, 0.30, 20000, 50, 40, 1.0, 0.010]          # print on demand / numérique
_F[37] = [3000, 0.13, 0.9, 2.2, 0.12, 0.03, 0.12, 120000, 25, 150, 0.5, 0.0]      # voitures d'occasion
FLIP = _F

# Audience (moteurs 38 à 41)
(AU_GPH, AU_VP, AU_MU, AU_SIG, AU_MON, AU_HAZ, AU_COLL, AU_CHURN, AU_COMP, AU_SALE, AU_PERS) = range(11)
NAU = 11
_A = np.zeros((NE, NAU))
_A[38] = [2.0, 0.02, 7.3, 1.6, 0.035, 0.005, 0.3, 0.015, 0.006, 1.0, 1]   # streaming / gaming
_A[39] = [25.0, 0.01, 8.5, 1.2, 0.012, 0.025, 0.5, 0.020, 0.0, 3.0, 0]    # sites SEO / affiliation
_A[40] = [0.8, 0.01, 7.6, 1.0, 0.25, 0.002, 0.2, 0.015, 0.004, 2.0, 1]     # newsletter payante
_A[41] = [1.0, 0.015, 9.9, 2.0, 0.01, 0.003, 0.4, 0.010, 0.005, 1.0, 1]   # musique / artiste
AUD = _A

# Spéculation (moteurs 42 à 44) — rendement mensuel sur la bankroll
(SP_MEAN, SP_SD, SP_VOL, SP_FATP, SP_FATM, SP_LEARN, SP_LCAP, SP_LIMIT, SP_HOURS) = range(9)
NSP = 9
_P = np.zeros((NE, NSP))
_P[42] = [-0.06, 0.03, 0.35, 0.05, 2.0, 0.001, 0.02, 5000.0, 40.0]    # paris sportifs (comptes limités si on gagne)
_P[43] = [-0.03, 0.03, 0.30, 0.05, 2.0, 0.002, 0.03, 1e12, 80.0]      # poker en ligne
_P[44] = [-0.10, 0.08, 0.60, 0.03, 4.0, 0.0, 0.0, 1e12, 20.0]         # memecoins / NFT
SPEC = _P

# Emplois (moteurs 45 à 47)
(SA_SAL, SA_GROW, SA_CAP, SA_HIRE, SA_TECH, SA_SALES, SA_NET, SA_INS, SA_HOURLY, SA_RATE, SA_COSTR,
 SA_DIPLOMA) = range(12)
NSA = 12
_J = np.zeros((NE, NSA))
_J[45] = [950, 0.05, 2600, 0.35, 0.010, 0.006, 0.010, 0.010, 0, 0.0, 0.0, 24]   # alternance
_J[46] = [1450, 0.025, 2600, 0.50, 0.004, 0.004, 0.004, 0.004, 0, 0.0, 0.0, 0]  # CDI / fonction publique
_J[47] = [0, 0.0, 0, 0.90, 0.0, 0.002, 0.0, 0.0, 1, 14.0, 0.28, 0]              # livreur / VTC
SAL = _J

# activités de base : études courtes, études longues, job à temps partiel, job à temps plein, rien
BASE_H = np.array([30., 35., 15., 35., 0.])
BASE_LIVING = np.array([450., 650., 450., 950., 250.])


@njit(cache=True)
def _poisson(lam, u, z):
    if lam <= 0.0:
        return 0.0
    if lam > 25.0:
        v = lam + math.sqrt(lam) * z
        return max(0.0, math.floor(v + 0.5) * 1.0)
    p = math.exp(-lam)
    c = p
    k = 0
    while u > c and k < 120:
        k += 1
        p *= lam / k
        c += p
    return k * 1.0


@njit(cache=True)
def _is_product(e):
    return FAMILY[e] == F_PROD


@njit(cache=True)
def _is_fulltime_job(e):
    f = FAMILY[e]
    return f == F_JOB or (f == F_SAL and SAL[e, SA_HOURLY] < 0.5)


@njit(cache=True)
def _is_services(e):
    f = FAMILY[e]
    return f == F_AGENCY or f == F_SVC or f == F_FREE


@njit(cache=True)
def _base_ceiling(e, ENG, tam):
    c = ENG[e, P_CEIL]
    if c == -1.0:
        return tam
    if c == -2.0:
        return 0.7 * tam
    if e == E_MICRO:
        return min(c, 0.004 * tam)
    return c


@njit(cache=True)
def sim_one(g, U, Z, UI, ZI, ENG, SEC, W, out, trace, do_trace):
    T = U.shape[0]
    # ---------------- profil : 18 ans, débutant
    talent = math.exp(0.35 * ZI[0])
    tal_l = math.sqrt(talent)
    tal_c = talent ** 0.6
    grit = 0.5 + 0.5 * UI[0]
    cash = 1500.0
    tech = 0.20 + 0.10 * UI[1]  # quelques bases en code
    sales = 0.06 + 0.08 * UI[2]
    cskill = 0.08 + 0.08 * UI[3]
    craft = 0.05 + 0.05 * UI[7]
    network = 0.03 + 0.03 * UI[4]  # région parisienne
    alpha = -0.012 + 0.0085 * ZI[2] + W[W_TRADE]
    spec_edge0 = ZI[9]
    cof_is_tech = UI[5] < 0.5
    cof_skill = 0.35 + 0.45 * UI[6]
    insight = 0.0
    cins = 0.05
    rep = 0.0
    audience = 50.0
    ctal = math.exp(0.8 * ZI[7] - 0.32)
    sq = math.exp(0.7 * ZI[8] - 0.245)

    # ---------------- gènes
    sector = g[G_SECTOR]
    channel = g[G_CHANNEL]
    tier = g[G_PRICE]
    H = HOURS[g[G_HOURS]]
    L = LEARN[g[G_LEARN]]
    csh = CONTENT_SH[g[G_CONTENT]]
    reinv = REINV[g[G_REINV]]
    fund = g[G_FUND]
    raise_trig = RAISE_TRIG[g[G_RAISE]]
    geo_gene = g[G_GEO]
    cof_gene = g[G_COF]
    narrow = g[G_NICHE] == 0
    keep = g[G_KEEP] == 1
    base_kind = g[G_BASE]
    h_start = HSTART[g[G_HSTART]]
    ramp_thr = RAMP_THR[g[G_RAMP]]

    wtp = SEC[sector, 0]
    reply0 = SEC[sector, 1]
    mat = SEC[sector, 2]
    disr = SEC[sector, 3]
    regl = SEC[sector, 4]
    comp = SEC[sector, 5]
    tam = SEC[sector, 6]
    cpl = SEC[sector, 7]
    heat = SEC[sector, 8]
    sec_close = (0.6 + 0.6 * mat) * (1.25 - 0.5 * comp) * (1.0 - 0.3 * regl)
    sec_pmf = (0.5 + disr) * (1.35 - 0.7 * comp) * (1.0 - 0.4 * regl) * (0.6 + 0.6 * mat)
    heat_f = 0.8 + 0.2 * heat

    geo_level = 2 if geo_gene == 3 else 0
    geo_final = 0
    if geo_gene == 1:
        geo_final = 1
    elif geo_gene >= 2:
        geo_final = 2
    svc_geo_price = 1.3 if geo_gene == 3 else 1.0

    # ---------------- activité de base et temps
    base_on = True
    diploma = 0
    base_months = 0
    base_salary = 0.0
    med = base_kind == 0 or base_kind == 1
    med_months = 0
    cesure_until = -1
    specialist = UI[10] < 0.4  # environ 40 % deviennent spécialistes (internat plus long, revenu plus élevé)
    doc_start = 132 if specialist else 108
    if base_kind == 2:
        base_salary = 750.0
    elif base_kind == 3:
        base_salary = 1450.0
    living = BASE_LIVING[base_kind]
    ramped = False
    rstreak = 0

    # ---------------- état
    eng = g[G_E1]
    phase = 0
    phase_t0 = 0
    pstreak = 0
    served = 0.0
    b2b_served = 0.0
    retainers = 0.0
    ret_price = 0.0
    partner = 0.0
    contacted = 0.0
    fr_rep = 0.0
    backlog = 0.0
    team_h = 0.0
    has_gig = False
    legacy_ret = 0.0
    legacy_price = 0.0
    employed = False
    emp_months = 0
    salary0 = 0.0
    launched = False
    n_prod = 0
    cq = 1.0
    churn_mult = 1.0
    progress = 0.0
    pmf = False
    pmf_t = -1
    customers = 0.0
    quality = 0.0
    warm = 0.0
    mrr = 0.0
    hist = np.zeros(12)
    pipe = np.zeros(12)
    company_cash = 0.0
    burn = 0.0
    stage = 0
    ownership = 1.0
    accel = False
    accel_tries = 0
    last_accel = -100
    last_raise = -100
    last_raise_arr = 0.0
    dead_company = False
    raised_seed = False
    seed_fails = 0
    exp_pen_until = -1
    winner = False
    adspend = 0.0
    wq = 1.0
    tr_skill = 0.0
    spec_learn = 0.0
    svc_train = -1
    svc_started = False
    deleg_cap = 0.0
    last_deleg = 0.0
    stock = 0.0
    flip_started = False
    aud2 = 0.0
    inv_cap = 0.0
    immo_units = 0.0
    immo_equity = 0.0
    job_months = 0
    last_job_salary = 0.0
    fraud_months = 0
    fraud_cum = 0.0
    fraud_expo_until = -1
    prison_until = -1
    caught = False
    has_cof = False
    seeking = cof_gene == 2
    if _is_product(eng) and cof_gene == 1:
        seeking = True
    T10k = -1
    income_prev = 0.0
    streak = 0
    quit = False
    fallback_inc = 1700.0
    burn_timer = 0
    stagnation = 0
    best_inc = 0.0
    best_mrr = 0.0
    inc12 = 0.0
    inc24 = 0.0
    inc60 = 0.0
    dur_sum = 0.0
    months_10k = 0.0
    last_profit = 0.0
    last_rev = 0.0
    last_dA = 0.0
    growth_sig = 0.0

    for t in range(T):
        u = U[t]
        z = Z[t]
        income = 0.0      # revenu du projet
        inc_b = 0.0       # revenu de l'activité de base
        milestone = False
        mrr_12 = hist[t % 12] if t >= 12 else 0.0
        mrr_3 = hist[(t - 3) % 12] if t >= 3 else 0.0
        active = False
        youth_t = 1.0 - t / 48.0
        if youth_t < 0.0:
            youth_t = 0.0
        # le malus d'âge s'efface avec l'expérience dans l'activité en cours (ou une vraie expérience B2B passée)
        youth_s = 1.0 - max(b2b_served, served) / 10.0
        if youth_s < 0.0:
            youth_s = 0.0
        youth = youth_t * youth_s
        fam = FAMILY[eng]

        # ---------------- année de césure : retour en médecine si le projet n'a pas confirmé
        if med and cesure_until == t and not quit:
            if income_prev >= 2.0 * ramp_thr:
                med = False  # le projet a confirmé : on arrête médecine
            else:
                base_on = True
                ramped = False
                rstreak = 0
        # ---------------- médecine (continue même si on abandonne le projet à côté)
        if med and base_on and prison_until <= t:
            med_months += 1
            network += 0.004 * (1.0 - network)
            if sector == 2:
                insight += 0.008 * (1.0 - insight)  # connaissance du terrain médical
            else:
                insight += 0.001 * (1.0 - insight)
            if med_months <= 36:
                inc_b = 0.0
                living = 450.0
            elif med_months <= 72:
                inc_b = 350.0  # externat
                living = 500.0
            elif med_months <= doc_start:
                inc_b = 2100.0  # internat (gardes comprises)
                living = 1100.0
                diploma = 1
            else:
                diploma = 2
                yrs = (med_months - doc_start) / 12.0
                inc_b = (12000.0 if specialist else 8000.0) * (1.0 + 0.04 * yrs)  # médecin, avant impôts
                living = 2000.0
        # ---------------- activité de base (études, job, rien)
        elif base_on and not quit and prison_until <= t:
            base_months += 1
            if base_kind == 0 or base_kind == 1:
                tech += (0.004 if base_kind == 0 else 0.006) * (1.0 - tech)
                sales += (0.003 if base_kind == 0 else 0.004) * (1.0 - sales)
                network += (0.003 if base_kind == 0 else 0.007) * (1.0 - network)
                dur_studies = 36 if base_kind == 0 else 60
                if base_months >= dur_studies:
                    diploma = 1 if base_kind == 0 else 2
                    if _is_fulltime_job(eng):
                        base_on = False
                        ramped = True
                    else:
                        base_kind = 3
                        base_salary = 1850.0 if diploma == 1 else 2700.0
                        living = 950.0 if diploma == 1 else 1100.0
                        base_months = 0
            elif base_kind == 4 and base_months == 36:
                living = 800.0
            if base_on:
                inc_b = base_salary * (1.0 + 0.02 * base_months / 12.0)
        # un emploi à temps plein remplace l'activité de base (après le diplôme si on étudie)
        if base_on and _is_fulltime_job(eng) and not (base_kind == 0 or base_kind == 1):
            base_on = False
            ramped = True
            inc_b = 0.0
            if living < 900.0:
                living = 900.0

        if prison_until > t:
            income = 0.0
        elif quit:
            if med and base_on:
                income = 0.0  # projet abandonné : on continue simplement médecine
                cash += inc_b - living
            else:
                income = fallback_inc * (1.0 + 0.02 * t / 12.0)
                cash += income - living
        else:
            active = True
            waiting_grad = _is_fulltime_job(eng) and base_on
            vh = H if ramped else h_start
            eff_week = vh if vh <= 50.0 else 50.0 + 0.35 * min(vh - 50.0, 20.0)
            eff_base = eff_week * 4.33
            if med and base_on:
                load = vh + (45.0 if med_months <= 36 else (50.0 if med_months <= 72 else 55.0))
            else:
                load = vh + (BASE_H[base_kind] if base_on else 0.0)
            eff = eff_base
            if burn_timer > 0:
                burn_timer -= 1
                eff *= 0.15
            else:
                over = (load - 50.0) / 10.0
                if over > 0.0:
                    hz = 0.012 * W[W_BURN] * over ** 1.6
                    if u[0] < hz:
                        burn_timer = 2 + int(u[16] * 3.0)
                        eff *= 0.15
                        retainers *= 0.85
                        if u[16] < 0.12:
                            quit = True
            side_inc = 0.0
            if cash < -2000.0 and inc_b < 500.0 and not (eng == E_JOB and employed):
                eff = max(eff - 65.0, 10.0)
                side_inc = 750.0
            cofh = 0.8 * eff if has_cof else 0.0
            tech_e = tech
            sales_e = sales
            if has_cof:
                if cof_is_tech:
                    tech_e = max(tech, cof_skill + 0.1)
                else:
                    sales_e = max(sales, cof_skill)
            mkt = 0.5 * sales_e + 0.5 * cskill

            if eng == E_JOB and employed:
                free_h = max(0.0, eff - 173.0)
            else:
                free_h = eff
            if waiting_grad:
                free_h = eff
            learn_h = L * free_h if (tech < 0.6 or sales < 0.6) else 0.0
            content_h = csh * free_h
            work = free_h - learn_h - content_h
            legacy_rev = 0.0
            if legacy_ret > 0.01:
                maint_h = min(0.3 * work, legacy_ret * 3.0)
                work -= maint_h
                legacy_rev = legacy_ret * legacy_price
                legacy_ret *= (1.0 - 0.04 * W[W_CHURN])
            rev = 0.0
            cost = 0.0
            tech_h = 0.0
            sales_h = 0.0
            craft_h = 0.0
            ins_h = 0.0
            intensity = 1.0
            growth_ok = True
            b2b_prod = False
            invest_gain = 0.0

            # ================= MOTEURS =================
            if waiting_grad:
                growth_ok = False
                tech_h = 0.5 * work
                sales_h = 0.2 * work

            elif eng == E_JOB:
                growth_ok = False
                if not employed:
                    tech_h = work * 0.8
                    sales_h = work * 0.1
                    p_h = (-0.08 + 0.55 * tech_e + 0.15 * sales_e + 0.1 * network + 0.08 * diploma) * 0.75
                    if p_h > 0.45:
                        p_h = 0.45
                    if p_h > 0.0 and u[2] < p_h:
                        employed = True
                        milestone = True
                        salary0 = (2000.0 + 1500.0 * tech) * (1.0 + 0.2 * diploma)
                else:
                    emp_months += 1
                    rev = min(7500.0, salary0 * (1.0 + 0.07 * emp_months / 12.0))
                    last_job_salary = rev
                    tech += 0.02 * tal_l * (1.0 - tech)
                    sales += 0.008 * (1.0 - sales)
                    network += 0.02 * (1.0 - network)
                    insight += 0.012 * (1.0 - insight)
                    rep = min(1.0, rep + 0.004)
                    tech_h = work * 0.5

            elif eng == E_FREE:
                growth_ok = False
                sales_h = 0.25 * work
                cap_days = min(18.0, 0.75 * (work + cofh) / 8.0)
                chm = 0.85
                if channel == 4:
                    chm = 1.3
                elif channel == 1:
                    chm = 1.0
                geo_w = 0.7 if geo_gene == 3 else 1.0
                prop = min(sales_h * 2.0, 70.0)
                win = (0.006 + 0.05 * fr_rep + 0.025 * tech_e) * FR_TWIN[tier] * tal_c * W[W_SERV] * chm * geo_w * sq \
                    * (1.0 - 0.25 * youth)
                lam = prop * win * math.exp(0.3 * z[0] - 0.045) + audience * 0.0001 * FR_TWIN[tier]
                backlog += _poisson(lam, u[3], z[7]) * 5.5
                days = min(backlog, cap_days)
                backlog = (backlog - days) * 0.8
                tjm = (200.0 + 380.0 * tech_e) * FR_TJM[tier] * (1.25 if geo_gene == 3 else 1.0) \
                    * (0.8 + 0.4 * fr_rep) * math.exp(-0.004 * t * W[W_COMMOD])
                rev = days * tjm
                cost = 0.12 * rev + 60.0
                fr_rep = min(1.0, fr_rep * 0.995 + 0.012 * days / 10.0 * (0.5 + tech_e))
                tech_h = days * 8.0
                ins_h = days * 8.0 * 0.3
                served += days / 20.0
                b2b_served += days / 20.0

            elif eng == E_AGENCY:
                avail = work + cofh
                ret_h = retainers * 6.0 * math.sqrt(AG_SCOPE[tier]) * (1.3 - 0.5 * tech_e)
                sales_h = avail - ret_h - 40.0
                if sales_h > 0.5 * avail:
                    sales_h = 0.5 * avail
                if sales_h < 0.2 * avail:
                    sales_h = 0.2 * avail
                geo_p = 1.0
                if geo_gene == 3:
                    geo_p = 0.55 + 0.45 * min(1.0, served / 15.0 + rep)
                meet = 0.0
                if channel == 0:
                    pool = (40000.0 if narrow else 120000.0) * (6.0 if geo_gene == 3 else 1.0)
                    rr = reply0 * (0.45 + 0.9 * sales_e) * (1.35 if narrow else 1.0) * geo_p * W[W_SERV] \
                        / (1.0 + contacted / pool)
                    meet = 9.0 * sales_h * rr * 0.45
                    contacted += 9.0 * sales_h
                elif channel == 1:
                    content_h += 0.8 * sales_h
                elif channel == 2:
                    budget = 300.0 if cash > 3000.0 else 0.0
                    budget += reinv * max(last_profit, 0.0) * 0.5
                    meet = budget / (2.5 * cpl * (1.0 + 0.5 * tier) / (0.6 + 0.8 * sales_e)) * geo_p * W[W_SERV]
                    if meet > sales_h / 1.5:
                        meet = sales_h / 1.5
                    cost += budget
                elif channel == 3:
                    partner += 0.04 * sales_h / 40.0 * (1.0 - partner) * (0.5 + network)
                    meet = partner * 10.0 * (0.5 + mat) * geo_p * W[W_SERV]
                elif channel == 4:
                    meet = sales_h * 0.10 * (0.3 + rep) * W[W_SERV]
                else:
                    meet = sales_h * 0.06 * (0.4 + sales_e) * (0.4 + network) * geo_p * W[W_SERV]
                    network += 0.015 * sales_h / 40.0 * (1.0 - network)
                meet += 0.05 * retainers + audience * 0.0002 * (1.3 if narrow else 1.0)
                meet *= sq * math.exp(0.35 * z[0] - 0.06 - 0.005 * t * W[W_COMMOD])
                cred = 0.6 + 0.5 * (1.0 - math.exp(-served / 4.0)) + 0.25 * rep
                if cred > 1.1:
                    cred = 1.1
                mix = 0.5 * tech_e + 0.5 * sales_e
                gate = 1.0
                if tier >= 2:
                    gate = min(1.0, 0.4 + 0.6 * mix / 0.55)
                pc = (0.05 + 0.22 * mix) * cred * AG_TCLOSE[tier] * gate * sec_close * tal_c * math.sqrt(geo_p) \
                    * (1.1 if narrow else 1.0) * W[W_SERV] * (1.0 - 0.3 * youth)
                if pc > 0.6:
                    pc = 0.6
                new_cl = _poisson(meet * pc, u[3], z[7])
                proj_h = 45.0 * AG_SCOPE[tier] * (1.6 - tech_e) / 1.2 * (1.0 + 0.3 * regl)
                cap_h = avail - sales_h - ret_h + team_h
                if cap_h < 0.0:
                    cap_h = 0.0
                need = new_cl * proj_h
                if need > cap_h:
                    if reinv > 0.0 and cash > 0.0:
                        cost += 40.0 * (need - cap_h)
                    else:
                        new_cl = math.floor(cap_h / proj_h) * 1.0
                        need = new_cl * proj_h
                pf = (0.75 if channel == 4 else 1.0) * math.exp(-0.005 * t * W[W_COMMOD]) * wtp * svc_geo_price
                rev = new_cl * AG_SETUP[tier] * pf + retainers * ret_price
                rn = new_cl * 0.40
                crr = (0.085 - 0.03 * tech_e + 0.008 * tier) * W[W_CHURN]
                rk = retainers * (1.0 - crr)
                if rk + rn > 1e-9:
                    ret_price = (rk * ret_price + rn * AG_RET[tier] * pf) / (rk + rn)
                retainers = rk + rn
                served += new_cl
                b2b_served += new_cl
                rep = min(1.0, rep * 0.995 + 0.03 * new_cl * (0.4 + tech_e))
                cost += 150.0 + 25.0 * retainers
                tech_h = min(need, cap_h) + 0.5 * ret_h
                if tech_h > avail:
                    tech_h = avail
                ins_h = tech_h + 0.3 * sales_h

            elif eng == E_CLOSER:
                growth_ok = False
                if not has_gig:
                    pg = (0.25 + 0.5 * sales_e) * W[W_CLOSER] * (1.0 - 0.2 * youth_t)
                    if u[2] < pg:
                        has_gig = True
                        milestone = True
                    sales_h = 0.3 * work
                if has_gig:
                    calls = min(100.0, 0.55 * work) * 0.6 * math.exp(0.35 * z[5] - 0.06) * min(sq, 1.5)
                    gate = 1.0
                    if tier >= 2:
                        gate = min(1.0, sales_e / 0.45)
                    crt = (0.05 + 0.27 * sales_e) * CL_TCLOSE[tier] * gate * math.sqrt(talent) * (1.0 - 0.1 * youth)
                    rev = calls * crt * CL_COMM[tier] * W[W_CLOSER]
                    sales_h = calls * 1.5
                    intensity = 1.4
                    if u[3] < 0.08:
                        has_gig = False
                cost = 50.0
                network += 0.004 * (1.0 - network)

            elif fam == F_PROD:
                b2b_prod = ENG[eng, P_B2B] > 0.5
                if b2b_prod:
                    I_eff = insight
                elif eng == E_MARKET:
                    I_eff = max(insight, cins)
                else:
                    I_eff = max(cins, 0.5 * insight)
                funded_now = stage >= 1
                team = burn / 7000.0 if funded_now else team_h / 140.0
                margin = ENG[eng, P_MARGIN]
                if not launched:
                    bh = 0.8 * work + (cofh if cof_is_tech else 0.2 * cofh) + team * 140.0 * 0.6
                    be = 1.0 if tech_e >= ENG[eng, P_MINTECH] else 0.2
                    progress += bh * be * (0.5 + tech_e)
                    tech_h = 0.8 * work
                    sales_h = 0.2 * work
                    ins_h = 0.2 * work * (1.0 if b2b_prod else 0.5)
                    if progress >= ENG[eng, P_BUILD] * 1.2:
                        need_cap = ENG[eng, P_CAPITAL]
                        if company_cash >= need_cap:
                            company_cash -= need_cap
                            launched = True
                        elif cash >= need_cap + 500.0:
                            cash -= need_cap
                            launched = True
                        if launched:
                            milestone = True
                            customers += warm
                            warm = 0.0
                            quality = 0.15
                    cost = 50.0
                else:
                    if not pmf:
                        ph = ENG[eng, P_PMF] * (0.12 + 0.88 * I_eff) ** (ENG[eng, P_INSEXP] * W[W_INSEXP]) \
                            * (0.3 + 0.7 * tech_e) * (0.5 + quality) \
                            * (sec_pmf if (b2b_prod or eng == E_MARKET) else 1.0) \
                            * (1.5 if narrow else 1.0) * math.sqrt(talent) * (1.25 if has_cof else 1.0) \
                            * (1.3 if accel else 1.0) * (1.5 if funded_now else 1.0) * W[W_PMF]
                        if eng == 31 and diploma == 0 and network < 0.4:
                            ph *= 0.3  # défense : habilitations, crédibilité, réseau institutionnel
                        if u[2] < ph:
                            pmf = True
                            pmf_t = t
                            milestone = True
                            cq = min(6.0, math.exp(1.0 * ZI[3 + (n_prod % 4)] - 0.5))
                    elif u[15] < 0.02:
                        cq *= 0.5
                        churn_mult = min(3.0, churn_mult * 1.3)
                    gtm_f = 0.55 * work + (0.2 * cofh if cof_is_tech else 0.7 * cofh)
                    prod_f = 0.45 * work + (0.8 * cofh if cof_is_tech else 0.3 * cofh)
                    gtm = gtm_f + 0.35 * team * 140.0 * 0.5 / (1.0 + team / 60.0)
                    prod = prod_f + team * 140.0 * 0.4 / (1.0 + team / 60.0)
                    quality += 0.05 * prod / 100.0 * (1.0 - quality) * (0.5 + tech_e)
                    if quality > 1.0:
                        quality = 1.0
                    nf = 1.0
                    if narrow:
                        if pmf:
                            x = (t - pmf_t - 24.0) / 36.0
                            if x < 0.0:
                                x = 0.0
                            if x > 1.0:
                                x = 1.0
                            nf = 0.35 + 0.65 * x
                        else:
                            nf = 0.35
                    ceil = _base_ceiling(eng, ENG, tam) * GEO_CEIL[geo_level] * nf
                    sat = 1.0 - 12.0 * mrr / ceil
                    if sat < 0.0:
                        sat = 0.0
                    arpu = ENG[eng, P_ARPU] * TIER_PRICE_PROD[int(ENG[eng, P_ELAST]), tier]
                    if ENG[eng, P_ARPU] < 1000.0:
                        arpu *= GEO_ARPU[geo_level]
                        if b2b_prod:
                            arpu *= wtp
                    else:
                        arpu *= min(GEO_ARPU[geo_level], 1.15)  # gros contrats : prix déjà « grands comptes »
                    el = ELAST[int(ENG[eng, P_ELAST]), tier]
                    geo_p = 1.0
                    if geo_gene == 3:
                        if b2b_prod:
                            geo_p = 0.55 + 0.45 * min(1.0, rep + network + customers / 50.0)
                        else:
                            geo_p = 0.85 + 0.15 * min(1.0, rep + network + customers / 50.0)
                    bi = 1 if b2b_prod else 0
                    acq = gtm * ENG[eng, P_ACQ] / 100.0 * CHP[channel, bi] \
                        * (0.4 + (sales_e if b2b_prod else mkt)) * el * geo_p * math.sqrt(talent)
                    if b2b_prod:
                        acq *= (1.3 if narrow else 1.0) * (0.6 + 0.6 * mat) * (1.0 - 0.25 * youth)
                    if channel == 2:
                        if funded_now:
                            ab = 0.25 * burn
                        else:
                            ab = reinv * max(last_profit, 0.0) * 0.5
                            if cash > 3000.0:
                                ab += 200.0
                        cac = arpu * ENG[eng, P_PAYBACK] / (0.5 + mkt) * (1.0 + math.sqrt(ab / 50000.0))
                        acq += ab / cac * CHP[2, bi]
                        cost += ab
                    if b2b_prod:
                        acq += audience * 0.0002 * el * (0.4 if narrow else 0.15)
                    else:
                        acq += audience * 0.0006 * el
                    if not pmf:
                        acq *= 0.35
                    else:
                        acq *= cq
                    heavy = ENG[eng, P_ARPU] >= 800.0 and not funded_now
                    if heavy:
                        acq *= 0.3  # gros contrats (défense, santé, énergie, hardware) : cycles de vente longs sans équipe financée
                    acq *= math.exp(0.35 * z[1] - 0.06) * sat
                    gb = 1.0 + 0.12 * stage + (0.2 if has_cof else 0.0)
                    if funded_now:
                        size_f = 1.0 / (1.0 + (12.0 * mrr / 1e6) ** 0.6)
                    else:
                        size_f = 0.7 / (1.0 + (12.0 * mrr / 3e5) ** 0.6)
                    org = customers * ENG[eng, P_GORG] * W[W_GROWTH] * ((cq * size_f) if pmf else 0.15) * sat * gb \
                        * math.sqrt(min(1.0, el))
                    if t < exp_pen_until:
                        org *= 0.8
                    if heavy:
                        org *= 0.5
                    chn = customers * ENG[eng, P_CHURN] * W[W_CHURN] * (1.0 if pmf else 2.0) * (1.3 - 0.6 * quality) \
                        * churn_mult * TIER_CHURN[tier]
                    customers += acq + org - chn
                    if customers < 0.0:
                        customers = 0.0
                    mrr = customers * arpu
                    rev = mrr
                    cost += mrr * (1.0 - margin) + 100.0
                    if not funded_now:
                        cost += 0.2 * max(mrr - 3000.0, 0.0)
                    tech_h = prod_f
                    sales_h = gtm_f
                    ins_h = gtm_f * (0.5 if b2b_prod else 0.2)
                    if not b2b_prod:
                        cins += 0.03 * (1.0 - cins)
                    arr = 12.0 * mrr
                    if geo_gene == 1 or geo_gene == 2:
                        if geo_level == 0 and arr >= 1e6:
                            if company_cash >= 150e3:
                                company_cash -= 150e3
                                geo_level = 1
                                exp_pen_until = t + 6
                            elif cash >= 150e3:
                                cash -= 150e3
                                geo_level = 1
                                exp_pen_until = t + 6
                        elif geo_level == 1 and geo_gene == 2 and arr >= 5e6:
                            if company_cash >= 1e6:
                                company_cash -= 1e6
                                geo_level = 2
                                exp_pen_until = t + 6
                            elif cash >= 1e6:
                                cash -= 1e6
                                geo_level = 2
                                exp_pen_until = t + 6
                    if mrr_12 > 500.0:
                        growth_sig = mrr / mrr_12 - 1.0
                    elif mrr_3 > 200.0:
                        growth_sig = (mrr / mrr_3) ** 4 - 1.0
                    else:
                        growth_sig = 0.0
                    if growth_sig > 6.0:
                        growth_sig = 6.0

                # ---------------- financement
                if fund >= 1 and not dead_company:
                    arr = 12.0 * mrr
                    vcf = ENG[eng, P_VCHOT] * heat_f * GEO_VC[geo_level] * W[W_VC]
                    if diploma == 2 or (med_months > 36 and sector == 2):
                        vcf *= 1.25
                    else:
                        vcf *= (1.0 - 0.35 * youth_t)
                    team_f = 1.6 if has_cof else 0.7
                    if not ramped:
                        vcf *= 0.3  # les investisseurs financent rarement un fondateur à temps partiel
                    fast = fund == 3
                    if fund == 1 and (not accel) and accel_tries < 3 and t - last_accel >= 6 \
                            and (launched or progress >= 0.5 * ENG[eng, P_BUILD]):
                        accel_tries += 1
                        last_accel = t
                        tr = min(1.0, mrr / 15000.0)
                        pa = 0.003 * (1.0 + 6.0 * tr) * (1.6 if has_cof else 1.0) * math.sqrt(talent) \
                            * vcf * (0.5 + tech_e)
                        if u[5] < pa:
                            accel = True
                            milestone = True
                            company_cash += 450e3
                            ownership *= 0.865
                            network = min(1.0, network + 0.35)
                            if stage < 1:
                                stage = 1
                            burn = max(burn, 450e3 / 20.0)
                    if stage < 2:
                        if (fund >= 2 or accel) and arr >= raise_trig and (launched or accel) \
                                and t - last_raise >= 4:
                            last_raise = t
                            s_arr = 1.0 / (1.0 + math.exp(-(math.log10(arr + 1.0) - 5.6) / 0.3))
                            gf = growth_sig / 1.5
                            if gf < 0.3:
                                gf = 0.3
                            if gf > 1.5:
                                gf = 1.5
                            ps = (0.004 + 0.02 * network + 0.13 * s_arr * gf) * team_f * vcf * (1.8 if accel else 1.0) \
                                * min(1.4, cq ** 0.25) * 0.6 ** seed_fails
                            if arr >= 50e3 and growth_sig < 0.3:
                                ps = 0.0
                            if u[6] >= ps:
                                seed_fails += 1
                            else:
                                amt = 3e6 if fast else 2e6
                                company_cash += amt
                                ownership *= 0.75 if fast else 0.80
                                stage = 2
                                raised_seed = True
                                milestone = True
                                last_raise_arr = arr
                                burn = amt / (16.0 if fast else 22.0)
                                if legacy_ret > 0.0:
                                    cash += 3.0 * legacy_ret * legacy_price
                                    legacy_ret = 0.0
                    elif t - last_raise >= 4:
                        amt = 0.0
                        dil = 1.0
                        ok = False
                        if stage == 2 and arr >= 2.0e6 and growth_sig >= 1.5:
                            ok = True
                            amt = 15e6 if fast else 10e6
                            dil = 0.80
                        elif stage == 3 and arr >= 7e6 and growth_sig >= 1.0:
                            ok = True
                            amt = 50e6 if fast else 35e6
                            dil = 0.85
                        elif stage == 4 and arr >= 20e6 and growth_sig >= 0.6:
                            ok = True
                            amt = 110e6 if fast else 80e6
                            dil = 0.88
                        elif stage >= 5 and arr >= 2.0 * last_raise_arr and growth_sig >= 0.4 \
                                and t - last_raise >= 12:
                            ok = True
                            amt = 150e6
                            dil = 0.90
                        if ok:
                            last_raise = t
                            if u[6] < 0.2 * vcf * team_f:
                                company_cash += amt
                                ownership *= dil
                                if stage < 5:
                                    stage += 1
                                milestone = True
                                last_raise_arr = arr
                                burn = max(burn, amt / (16.0 if fast else 22.0))

            elif eng == E_ECOM:
                growth_ok = False
                tech_h = 0.2 * work
                sales_h = 0.8 * work
                cskill += 0.03 * (1.0 - cskill) * min(1.0, work / 150.0)
                if not winner:
                    tb = (cash - 300.0) * 0.4
                    if tb > 1200.0:
                        tb = 1200.0
                    if tb >= 100.0:
                        cost = tb + 60.0
                        rev = tb * 0.5
                        pw = 0.025 * (0.3 + 0.7 * mkt) * math.sqrt(talent) * W[W_ECOM] * (0.7 if tier == 3 else 1.0) \
                            * min(1.3, math.sqrt(tb / 600.0)) * min(1.0, work / 80.0)
                        if u[11] < pw:
                            winner = True
                            adspend = 1.5 * tb
                            wq = math.exp(0.25 * z[4])
                            milestone = True
                    else:
                        cost = 60.0
                else:
                    sat_e = 1.0 / (1.0 + adspend / 1e6)
                    roas = 2.2 * (0.7 + 0.6 * mkt) * wq * math.exp(0.2 * z[4] - 0.02) * sat_e * (0.85 if tier == 3 else 1.0)
                    rev = adspend * roas
                    cost = rev * 0.45 + adspend + 200.0
                    pr = rev - cost
                    if pr > 0.0:
                        adspend *= (1.2 + 0.5 * reinv)
                    else:
                        adspend *= 0.6
                    if adspend > max(cash, 0.0) + rev:
                        adspend = max(cash, 0.0) + rev
                    dh = 0.05 if tier == 3 else 0.10
                    if u[11] < dh or adspend < 100.0:
                        winner = False
                        adspend = 0.0

            elif eng == E_CONTENT:
                growth_ok = False
                content_h += 0.85 * work
                sales_h = 0.15 * work
                rev = audience * 0.04 * (0.5 + cskill) * (1.4 if narrow else 0.8)
                cost = 50.0

            elif eng == E_INFO:
                growth_ok = False
                content_h += 0.5 * work
                sales_h = 0.5 * work
                buyers = 1.5 * IP_CONV[tier] * (0.25 * audience + 2.0 * last_dA) * (0.5 + rep) * math.sqrt(talent) \
                    * math.exp(0.3 * z[6] - 0.045) * (1.0 - 0.2 * youth_t)
                if channel == 2:
                    ab = (200.0 if cash > 3000.0 else 0.0) + 0.5 * reinv * max(last_profit, 0.0)
                    cpa = IP_PRICE[tier] * 0.6 / (0.5 + mkt)
                    buyers += ab / cpa
                    cost += ab
                rev = buyers * IP_PRICE[tier]
                cost += 0.1 * rev + (0.12 * rev if tier >= 2 else 0.0) + 80.0
                rep = min(1.0, rep * 0.997 + 0.004 * buyers / (buyers + 10.0))
                if u[10] < 0.004 + 0.004 * tier:
                    audience *= 0.6
                    rep *= 0.3

            elif eng == E_TRADING:
                growth_ok = False
                lev = TR_LEV[tier]
                fat = 2.2 if u[13] < 0.08 else 1.0
                r = lev * (alpha + tr_skill) - 0.002 * lev + lev * 0.08 * z[3] * fat
                if r < -1.0:
                    r = -1.0
                capital = cash if cash > 0.0 else 0.0
                rev = capital * r
                tr_skill = min(0.004, tr_skill + 0.0002)
                if r <= -0.9 and u[12] < 0.5:
                    quit = True

            elif eng == E_FRAUD:
                growth_ok = False
                fraud_months += 1
                inc = 1500.0 * math.exp(0.4 * min(fraud_months, 10))
                if inc > 30000.0:
                    inc = 30000.0
                rev = inc * math.exp(0.5 * z[6] - 0.125)
                fraud_cum += rev
                fraud_expo_until = t + 72
                hzf = (0.025 + 0.006 * math.log1p(fraud_cum / 10000.0)) * W[W_FRAUD]
                if u[9] < hzf:
                    caught = True

            # ---------------- services génériques
            elif fam == F_SVC:
                if svc_train < 0:
                    svc_train = int(SVC[eng, SV_GATE])
                if svc_train > 0:
                    svc_train -= 1
                    growth_ok = False
                    rev = SVC[eng, SV_GATEINC]
                    craft_h = 0.7 * work + (60.0 if SVC[eng, SV_GATEINC] > 0.0 else 0.0)
                    tech_h = 0.2 * work
                    if svc_train == 0:
                        milestone = True
                else:
                    if not svc_started:
                        capn = SVC[eng, SV_CAP]
                        if cash >= capn + 200.0:
                            cash -= capn
                            svc_started = True
                            milestone = True
                    if svc_started:
                        sk = SVC[eng, SV_SKILL]
                        skill = tech_e if sk == 0.0 else (sales_e if sk == 1.0 else craft)
                        if skill < SVC[eng, SV_SKFLOOR]:
                            skill = SVC[eng, SV_SKFLOOR]  # niveau de départ du métier (bac, formation suivie...)
                        online = SVC[eng, SV_ONLINE] > 0.5
                        avail = work + cofh - 0.12 * last_deleg  # encadrer ses salariés prend du temps
                        if avail < 5.0:
                            avail = 5.0
                        hrl = 1 if SVC[eng, SV_HOURLY] > 0.5 else 0
                        rec_h = retainers * SVC[eng, SV_RECH] * (1.0 if hrl == 1 else (1.3 - 0.6 * skill))
                        sales_h = avail - rec_h - 10.0
                        if sales_h > 0.5 * avail:
                            sales_h = 0.5 * avail
                        if sales_h < 0.15 * avail:
                            sales_h = 0.15 * avail
                        pool = SVC[eng, SV_POOL] * (0.5 if narrow else 1.0) * (2.0 if (online and geo_gene == 3) else 1.0)
                        leads = sales_h * SVC[eng, SV_LEAD] * CHS[channel] * (0.5 + sales_e) \
                            * (1.25 if narrow else 1.0) * W[W_SERV] / (1.0 + contacted / pool)
                        contacted += 3.0 * sales_h
                        if channel == 1:
                            content_h += 0.6 * sales_h
                        elif channel == 2:
                            budget = (200.0 if cash > 2000.0 else 0.0) + reinv * max(last_profit, 0.0) * 0.5
                            cpl_s = SVC[eng, SV_PRICE] * TIER_PRICE_SVC[hrl, tier] * 0.4 + 30.0
                            la = budget / (cpl_s * (1.0 + budget / 5000.0)) / (1.0 + contacted / pool)
                            leads += la
                            contacted += 10.0 * la
                            cost += budget
                        elif channel == 5:
                            network += 0.012 * sales_h / 40.0 * (1.0 - network)
                            leads *= (0.6 + network)
                        leads += 0.03 * retainers + 0.01 * served + audience * 0.0003
                        leads *= sq * math.exp(0.35 * z[0] - 0.06)
                        cred = 0.6 + 0.5 * (1.0 - math.exp(-served / 5.0)) + 0.2 * rep
                        if cred > 1.1:
                            cred = 1.1
                        pc = SVC[eng, SV_CLOSE] * (0.5 + skill) * cred * TIER_CLOSE_SVC[hrl, tier] * tal_c \
                            * (1.0 - SVC[eng, SV_YOUTH] * youth)
                        if pc > 0.8:
                            pc = 0.8
                        new_u = _poisson(leads * pc, u[3], z[7])
                        if SVC[eng, SV_CYCLE] > 0.5:
                            cyc = int(SVC[eng, SV_CYCLE])
                            pipe[(t + cyc) % 12] += new_u
                            units = pipe[t % 12]
                            pipe[t % 12] = 0.0
                        else:
                            units = new_u
                        maxu = SVC[eng, SV_MAXU] * (1.5 if online else 1.0)
                        if units > maxu:
                            units = maxu
                        # part de marché locale plafonnée (~1 % du vivier)
                        rec_max = 0.01 * pool
                        if retainers > rec_max:
                            retainers = rec_max
                            rec_h = retainers * SVC[eng, SV_RECH] * (1.0 if hrl == 1 else (1.3 - 0.6 * skill))
                        # au projet, l'expérience fait gagner du temps ; à l'heure, une heure reste une heure
                        unit_h = SVC[eng, SV_HUNIT] * ((1.0 + 0.2 * (1.0 - skill)) if hrl == 1 else (1.4 - 0.8 * skill))
                        need = units * unit_h + rec_h
                        cap_h = avail - sales_h + team_h
                        if cap_h > SVC[eng, SV_MAXOWN] + team_h:
                            cap_h = SVC[eng, SV_MAXOWN] + team_h  # créneaux réellement facturables (soirs, week-ends...)
                        if cap_h < 0.0:
                            cap_h = 0.0
                        can_deleg = SVC[eng, SV_DELEG] > 0.5 and reinv > 0.0
                        cap_tot = cap_h + (deleg_cap if can_deleg else 0.0)
                        if need > cap_tot:
                            cut = math.ceil((need - cap_tot) / max(unit_h, 0.1))
                            units = max(0.0, units - cut)
                            need = units * unit_h + rec_h
                            if need > cap_tot and rec_h > 0.0:
                                keep_r = max(0.0, (cap_tot - units * unit_h) / rec_h)
                                if keep_r < 1.0:
                                    retainers *= keep_r
                                    rec_h *= keep_r
                                need = units * unit_h + rec_h
                            if can_deleg:
                                # on ne recrute pas plus vite qu'environ un mi-temps tous les 2 à 3 mois
                                deleg_cap = min(2000.0, deleg_cap + 25.0 * (0.5 + sales_e))
                        deleg_h = need - cap_h
                        if deleg_h < 0.0 or not can_deleg:
                            deleg_h = 0.0
                        pf = math.exp(-SVC[eng, SV_COMMOD] * t * W[W_COMMOD]) * TIER_PRICE_SVC[hrl, tier]
                        if SVC[eng, SV_WTP] > 0.5:
                            pf *= wtp
                        if online:
                            pf *= svc_geo_price
                        price = SVC[eng, SV_PRICE] * pf * math.exp(SVC[eng, SV_RISK] * z[6]
                                                                  - 0.5 * SVC[eng, SV_RISK] ** 2)
                        rev = units * price + retainers * ret_price
                        if need > 0.0:
                            cost += deleg_h * (rev / need) * SVC[eng, SV_LABOR]
                        cost += SVC[eng, SV_COSTR] * rev + 30.0
                        last_deleg = deleg_h
                        rn = units * SVC[eng, SV_RECSH]
                        crr = SVC[eng, SV_RECCH] * (1.2 - 0.4 * skill) * W[W_CHURN]
                        rk = retainers * (1.0 - crr)
                        if rk + rn > 1e-9:
                            ret_price = (rk * ret_price + rn * SVC[eng, SV_RECP] * pf) / (rk + rn)
                        retainers = rk + rn
                        served += units
                        if eng == 15 or eng == 16:
                            b2b_served += units
                        rep = min(1.0, rep * 0.995 + 0.02 * units / (1.0 + 0.1 * units) * (0.4 + skill))
                        own_h = min(need, cap_h)
                        if sk == 0.0:
                            tech_h = own_h
                        elif sk == 1.0:
                            sales_h += 0.5 * own_h
                        else:
                            craft_h = own_h
                        ns = SVC[eng, SV_NATSEC]
                        ins_h = own_h * SVC[eng, SV_INS] * (1.0 if (ns < 0.0 or int(ns) == sector) else 0.2)

            # ---------------- commerce / revente
            elif fam == F_FLIP:
                growth_ok = False
                if not flip_started:
                    capn = FLIP[eng, FL_CAPMIN]
                    if cash >= capn + 200.0:
                        stock = max(capn, 0.6 * (cash - 200.0))
                        cash -= stock
                        flip_started = True
                        milestone = True
                if flip_started and stock < 0.5 * FLIP[eng, FL_CAPMIN] and cash >= FLIP[eng, FL_CAPMIN] + 200.0:
                    cash -= FLIP[eng, FL_CAPMIN]
                    stock += FLIP[eng, FL_CAPMIN]
                if flip_started:
                    own_vol = (work + cofh) / FLIP[eng, FL_HPK] * 1000.0
                    cap_vol = stock * FLIP[eng, FL_TURNS]
                    vol = cap_vol
                    extra = 0.0
                    if vol > own_vol:
                        if reinv > 0.0:
                            extra = vol - own_vol
                        else:
                            vol = own_vol
                    vol *= math.exp(0.3 * z[0] - 0.045) * math.sqrt(sq)
                    sd = FLIP[eng, FL_SD]
                    m = FLIP[eng, FL_MARGIN] * (0.6 + 0.8 * mkt) * math.exp(sd * z[4] - 0.5 * sd * sd) \
                        / (1.0 + vol / FLIP[eng, FL_SAT]) * math.exp(-FLIP[eng, FL_COMMOD] * t * W[W_COMMOD]) * W[W_FLIP]
                    rev = vol * (1.0 + m)
                    cost = vol + FLIP[eng, FL_LABK] * extra / 1000.0 + FLIP[eng, FL_FIXED]
                    if u[11] < FLIP[eng, FL_LOSSP]:
                        stock *= (1.0 - FLIP[eng, FL_LOSSF])
                    sales_h = 0.6 * work
                    tech_h = 0.1 * work
                    cskill += 0.01 * (1.0 - cskill) * min(1.0, work / 100.0)
                    rep = min(1.0, rep * 0.997 + 0.002)

            # ---------------- audience
            elif fam == F_AUD:
                growth_ok = False
                ah = 0.85 * work
                if AUD[eng, AU_PERS] > 0.5:
                    content_h += ah
                else:
                    cskill += 0.04 * tal_l * ah / 100.0 * (1.0 - cskill)
                sales_h = 0.15 * work
                gr = ah * AUD[eng, AU_GPH] * (0.5 + cskill) * ctal * W[W_CONTENT] + aud2 * AUD[eng, AU_COMP]
                if ah > 10.0 and u[4] < AUD[eng, AU_VP] * (0.4 + cskill) * min(ctal, 2.5) * W[W_CONTENT]:
                    gr += math.exp(AUD[eng, AU_MU] + AUD[eng, AU_SIG] * z[2]) * (0.5 + cskill)
                aud2 = aud2 * (1.0 - AUD[eng, AU_CHURN]) + gr
                if u[10] < AUD[eng, AU_HAZ]:
                    aud2 *= (1.0 - AUD[eng, AU_COLL])
                rev = aud2 * AUD[eng, AU_MON] * (0.5 + cskill) * (1.3 if narrow else 0.9) * W[W_AUD]
                cost = 40.0

            # ---------------- spéculation
            elif fam == F_SPEC:
                growth_ok = False
                edge = SPEC[eng, SP_MEAN] + SPEC[eng, SP_SD] * spec_edge0 + spec_learn + W[W_SPEC]
                hf = min(1.0, work / SPEC[eng, SP_HOURS])
                fat = SPEC[eng, SP_FATM] if u[13] < SPEC[eng, SP_FATP] else 1.0
                r = edge * hf + SPEC[eng, SP_VOL] * math.sqrt(hf) * z[3] * fat
                bank = cash - 200.0 if cash > 200.0 else 0.0
                if bank > SPEC[eng, SP_LIMIT] and edge > 0.0:
                    r = 0.3 * r
                if r < -1.0:
                    r = -1.0
                rev = bank * r
                # seuls les joueurs doués progressent (jeu à somme nulle moins la commission)
                spec_learn = min(SPEC[eng, SP_LCAP], spec_learn + SPEC[eng, SP_LEARN] * hf * max(0.0, spec_edge0))
                if r <= -0.9 and u[12] < 0.5:
                    quit = True  # tout perdu : une fois sur deux, on arrête

            # ---------------- emplois
            elif fam == F_SAL:
                growth_ok = False
                if SAL[eng, SA_HOURLY] > 0.5:
                    rev = work * SAL[eng, SA_RATE]
                    cost = rev * SAL[eng, SA_COSTR]
                    sales_h = 0.05 * work
                else:
                    if not employed:
                        ph2 = SAL[eng, SA_HIRE] * (1.0 + 0.3 * diploma)
                        if u[2] < ph2:
                            employed = True
                            milestone = True
                            salary0 = SAL[eng, SA_SAL] * (1.0 + 0.35 * diploma)
                            job_months = 0
                    else:
                        job_months += 1
                        if SAL[eng, SA_DIPLOMA] > 0.0 and job_months == int(SAL[eng, SA_DIPLOMA]):
                            if diploma < 1:
                                diploma = 1
                            salary0 = salary0 * 1.6
                            milestone = True
                        rev = min(SAL[eng, SA_CAP] * (1.0 + 0.3 * diploma),
                                  salary0 * (1.0 + SAL[eng, SA_GROW] * job_months / 12.0))
                        last_job_salary = rev
                        tech += SAL[eng, SA_TECH] * (1.0 - tech)
                        sales += SAL[eng, SA_SALES] * (1.0 - sales)
                        network += SAL[eng, SA_NET] * (1.0 - network)
                        insight += SAL[eng, SA_INS] * (1.0 - insight)
                        tech_h = 0.1 * work

            # ---------------- investissement
            else:
                growth_ok = False
                if eng == E_ETF:
                    if cash > 1500.0:
                        move = 0.9 * (cash - 1500.0)
                        cash -= move
                        inv_cap += move
                    r = 0.0055 + 0.045 * z[3]
                    invest_gain = inv_cap * r
                    rev = invest_gain
                else:
                    if base_on and base_kind == 3 and base_months >= 12 and cash >= 12000.0 \
                            and immo_units < 1.0 + base_salary / 1500.0 + t / 48.0:
                        cash -= 12000.0
                        immo_units += 1.0
                        milestone = True
                    rev = immo_units * 150.0 * math.exp(0.1 * z[3])
                    immo_equity += immo_units * 350.0

            # ---------------- comptabilité
            if _is_product(eng) and stage >= 1 and not dead_company:
                if stage >= 2 and burn > 0.0 and u[8] < 0.013:
                    dead_company = True
                company_cash += rev - cost - burn
                if company_cash < 0.0:
                    if u[7] < 0.2 * W[W_VC]:
                        company_cash += 3.0 * burn
                        ownership *= 0.92
                    else:
                        op = rev - cost
                        if op < 0.5 * burn and u[8] < 0.5:
                            dead_company = True
                        burn = max(0.9 * op, 0.0)
                        company_cash = 0.0
                if burn > 0.0 and company_cash > 0.0:
                    income = SALARY[stage] + legacy_rev
                else:
                    income = min(SALARY[stage], max(rev - cost, 0.0) * 0.5) + legacy_rev
                team_h = 0.0
                last_profit = 0.0
            else:
                profit = rev - cost + legacy_rev
                gs = 0.0
                if fam == F_FLIP:
                    if profit > 0.0:
                        gs = reinv * profit
                        stock += gs
                    stock += min(profit, 0.0)
                    if stock < 0.0:
                        stock = 0.0
                    team_h = 0.0
                else:
                    if growth_ok and profit > 0.0:
                        gs = reinv * profit
                    team_h = gs / 45.0
                income = profit - gs
                if fam == F_FLIP and profit < 0.0:
                    income = 0.0
                if has_cof and not (eng == E_JOB or eng == E_CLOSER or eng == E_TRADING or eng == E_FRAUD
                                    or fam == F_SPEC or fam == F_SAL or fam == F_INV):
                    income *= 0.55
                last_profit = profit
            last_rev = rev
            if eng == E_ETF:
                inv_cap += invest_gain
                cash += inc_b + side_inc - living
            else:
                cash += income + inc_b + side_inc - living

            # ---------------- compétences
            tech += 0.025 * tal_l * tech_h / 100.0 * (1.0 - tech) + 0.04 * tal_l * 0.6 * learn_h / 100.0 * (1.0 - tech)
            sales += 0.035 * intensity * tal_l * sales_h / 100.0 * (1.0 - sales) \
                + 0.04 * tal_l * 0.4 * learn_h / 100.0 * (1.0 - sales)
            craft += 0.03 * tal_l * craft_h / 100.0 * (1.0 - craft)
            insight += 0.035 * tal_l * ins_h / 100.0 * (1.0 - insight)
            cskill += 0.04 * tal_l * content_h / 100.0 * (1.0 - cskill)
            if tech > 0.99:
                tech = 0.99
            if sales > 0.99:
                sales = 0.99
            if craft > 0.99:
                craft = 0.99
            if insight > 0.99:
                insight = 0.99
            if cskill > 0.99:
                cskill = 0.99
            # ---------------- audience personnelle
            gm = (0.9 if narrow else 1.2) * W[W_CONTENT]
            dA = content_h * (0.8 + 3.0 * cskill) * gm * ctal
            if content_h > 5.0:
                dA += audience * 0.008
            if content_h > 10.0 and u[4] < 0.06 * (0.4 + cskill) * W[W_CONTENT] * min(ctal, 2.5):
                dA += math.exp(7.824 + 1.4 * z[2]) * (0.5 + cskill)
            audience = audience * 0.988 + dA
            last_dA = dA
            cins += content_h * 0.0002 * (1.0 - cins)
            # ---------------- associé
            if seeking and not has_cof:
                pcf = 0.012 + 0.15 * network + (0.06 if (income > 4000.0 or mrr > 5000.0) else 0.0) \
                    + (0.08 if accel else 0.0)
                if u[14] < pcf:
                    has_cof = True
                    ownership *= 0.55
                    milestone = True
            elif has_cof and u[17] < 0.008:
                has_cof = False
                ownership = min(1.0, ownership * 1.25)

        # ---------------- justice
        if (not caught) and fraud_expo_until > t and not (active and eng == E_FRAUD) \
                and u[9] < 0.012 * W[W_FRAUD]:
            caught = True
        if caught and prison_until < 0:
            prison_until = t + 24 + int(24.0 * u[12])
            cash = -50000.0
            quit = True
            base_on = False
            fallback_inc = 1300.0
            income = 0.0
            inc_b = 0.0

        # ---------------- passage à temps plein
        inc_v = income if active else 0.0
        training_now = FAMILY[eng] == F_SVC and svc_train > 0
        if active and not quit and not ramped:
            if inc_v >= ramp_thr and not training_now:
                rstreak += 1
            else:
                rstreak = 0
            if rstreak >= 3:
                ramped = True
                milestone = True
                if base_on:
                    base_on = False
                    if med and base_kind == 1 and cesure_until < 0:
                        cesure_until = t + 12  # année de césure, puis décision
                    elif med:
                        med = False  # on arrête médecine
                    if living < 900.0:
                        living = 900.0

        income_prev = income
        total = income + (inc_b if (base_on and not quit) else 0.0)
        if quit:
            total = income + (inc_b if (med and base_on) else 0.0)

        # ---------------- suivi de l'objectif 10 k€/mois (revenu total : projet + activité de base)
        if total >= 10000.0:
            streak += 1
        else:
            streak = 0
        if streak >= 3 and T10k < 0:
            T10k = t + 1
        if t == 11:
            inc12 = total
        elif t == 23:
            inc24 = total
        elif t == 59:
            inc60 = total
        if t >= 54 and t < 60:
            dur_sum += total
        if t >= 36 and total >= 10000.0:
            months_10k += 1.0
        hist[t % 12] = mrr
        if do_trace:
            trace[t, 0] = total
            trace[t, 1] = eng
            trace[t, 2] = customers
            trace[t, 3] = mrr
            trace[t, 4] = tech
            trace[t, 5] = sales
            trace[t, 6] = insight
            trace[t, 7] = audience
            trace[t, 8] = retainers
            trace[t, 9] = stage
            trace[t, 10] = 1.0 if has_cof else 0.0
            trace[t, 11] = cq
            trace[t, 12] = 1.0 if ramped else 0.0
            trace[t, 13] = cash
            trace[t, 14] = stock + aud2 + inv_cap
            trace[t, 15] = 1.0 if quit else 0.0

        if active and not quit:
            # ---------------- transitions de phase (déclenchées par le revenu du projet)
            for _k in range(2):
                if phase >= 2:
                    break
                nxt = g[G_E2] if phase == 0 else g[G_E3]
                if nxt == eng:
                    phase += 1
                    continue
                thr = THR[g[G_THR12]] if phase == 0 else THR[g[G_THR23]]
                dl = DLN[g[G_DL12]] if phase == 0 else DLN[g[G_DL23]]
                if inc_v >= thr:
                    pstreak += 1
                else:
                    pstreak = 0
                if pstreak >= 3 or (t + 1 - phase_t0) >= dl:
                    old = eng
                    eng = nxt
                    phase += 1
                    phase_t0 = t + 1
                    pstreak = 0
                    fo = FAMILY[old]
                    new_b2b = _is_product(eng) and ENG[eng, P_B2B] > 0.5
                    served_old = served
                    served = 0.0
                    contacted = 0.0
                    rep *= 0.5
                    hourly_old = fo == F_SVC and SVC[old, SV_HOURLY] > 0.5
                    if fo == F_AGENCY or fo == F_SVC:
                        if _is_product(eng) and keep and not hourly_old:
                            legacy_ret += retainers
                            legacy_price = ret_price
                            if new_b2b:
                                warm = 0.25 * retainers
                        else:
                            cash += 3.0 * retainers * ret_price
                            if new_b2b:
                                warm = 0.1 * retainers
                        retainers = 0.0
                        team_h = 0.0
                        svc_started = False
                        svc_train = -1
                        deleg_cap = 0.0
                        last_deleg = 0.0
                    elif fo == F_FREE and new_b2b:
                        warm = 0.05 * served_old
                    if fo == F_FLIP:
                        cash += 0.85 * stock
                        stock = 0.0
                        flip_started = False
                    if fo == F_AUD:
                        cash += 0.5 * AUD[old, AU_SALE] * 12.0 * max(last_profit, 0.0)
                        aud2 = 0.0
                    if _is_product(old) or _is_product(eng):
                        if _is_product(old):
                            n_prod += 1
                        cq = 1.0
                        churn_mult = 1.0
                        launched = False
                        progress = 0.0
                        pmf = False
                        customers = 0.0
                        quality = 0.0
                        mrr = 0.0
                        if not _is_product(eng):
                            burn = 0.0
                    if _is_product(eng) and cof_gene == 1:
                        seeking = True
                    if _is_fulltime_job(old) and not _is_fulltime_job(eng):
                        # on garde son emploi et on lance le projet à côté ; temps plein seulement quand il rapporte
                        base_on = True
                        base_kind = 3
                        base_salary = max(last_job_salary, 1450.0)
                        base_months = 0
                        ramped = False
                        rstreak = 0
                    if old == E_JOB or fo == F_SAL:
                        employed = False
                    if old == E_CLOSER:
                        has_gig = False
                    if old == E_ECOM:
                        winner = False
                        adspend = 0.0
                    if FAMILY[eng] == F_SVC:
                        svc_train = -1
                        svc_started = False
                break
            # ---------------- motivation / abandon
            if mrr > best_mrr * 1.2 + 50.0:
                best_mrr = mrr
                milestone = True
            if milestone or inc_v > best_inc * 1.1 + 200.0:
                stagnation = 0
            else:
                stagnation += 1
            if inc_v > best_inc:
                best_inc = inc_v
            safe_job = (eng == E_JOB and employed) or (FAMILY[eng] == F_SAL and SAL[eng, SA_HOURLY] < 0.5) \
                or FAMILY[eng] == F_INV or (FAMILY[eng] == F_SVC and svc_train > 0)
            if not safe_job:
                comfort = 1.0
                if total >= 6000.0:
                    comfort = 0.05
                elif total >= 2500.0:
                    comfort = 0.2
                elif not ramped:
                    comfort = 0.85  # projet à côté : on abandonne moins vite tant qu'il ne coûte que quelques heures
                qh = (0.004 + 0.03 * min(1.0, stagnation / 12.0)) * (1.6 - grit) * comfort
                if u[1] < qh:
                    quit = True
            if cash < -6000.0:
                quit = True
            if (eng == E_TRADING or FAMILY[eng] == F_SPEC) and cash < 100.0 and inc_b < 500.0:
                quit = True
            if dead_company and _is_product(eng):
                quit = True
            if quit:
                fallback_inc = min(4500.0, 1450.0 + 500.0 * diploma + 2000.0 * max(tech, sales, craft))
                if not (med and base_on):
                    base_on = False

    # ---------------- bilan à 10 ans
    val = 0.0
    pu = 0.0
    prod_alive = 0.0
    fam = FAMILY[eng]
    if not quit and not dead_company:
        if _is_product(eng) and launched and mrr > 0.0:
            prod_alive = 1.0
            arr = 12.0 * mrr
            gy = growth_sig
            moat = (0.6 + 0.6 * insight) if ENG[eng, P_MOAT] > 0.5 else 1.0
            m = ENG[eng, P_M0] + ENG[eng, P_M1] * max(gy, 0.0)
            if m > ENG[eng, P_MCAP]:
                m = ENG[eng, P_MCAP]
            if gy < 0.0:
                m *= 0.7
            boot = 1.0 if stage >= 1 else 0.6  # une entreprise jamais financée se valorise à des multiples plus bas
            val = arr * m * moat * GEO_MULT[geo_level] * heat_f * W[W_MULT] * boot
            gl = max(geo_level, geo_final)
            cf = _base_ceiling(eng, ENG, tam) * GEO_CEIL[gl] * 0.6
            af = arr
            gg = min(gy, 4.0)
            for _y in range(2):
                gg *= 0.5
                af = af * (1.0 + max(gg, -0.3))
                if af > cf:
                    af = cf
            m2 = ENG[eng, P_M0] + ENG[eng, P_M1] * max(gg, 0.0)
            if m2 > ENG[eng, P_MCAP]:
                m2 = ENG[eng, P_MCAP]
            vf = max(val, af * m2 * moat * GEO_MULT[gl] * heat_f * W[W_MULT] * boot)
            if val >= 0.925e9:
                pu = 1.0
            else:
                x = (LOG_UNICORN - math.log10(vf + 1.0)) / 0.30
                pu = 0.5 * math.erfc(x / math.sqrt(2.0))
        elif eng == E_AGENCY:
            val = 0.8 * 12.0 * max(last_profit, 0.0)
        elif eng == E_CONTENT or eng == E_INFO:
            val = 2.0 * 12.0 * max(last_profit, 0.0)
        elif eng == E_ECOM:
            val = 2.5 * 12.0 * max(last_profit, 0.0)
            if tier == 3:
                val += 0.3 * 12.0 * last_rev
        elif fam == F_SVC:
            val = SVC[eng, SV_SALE] * 12.0 * max(last_profit, 0.0)
        elif fam == F_FLIP:
            val = stock + FLIP[eng, FL_SALE] * 12.0 * max(last_profit, 0.0)
        elif fam == F_AUD:
            val = AUD[eng, AU_SALE] * 12.0 * max(last_profit, 0.0)
    wealth = cash + ownership * val * 0.6 + inv_cap + immo_equity
    if fam == F_FLIP and (quit or dead_company):
        wealth += stock

    for k in range(NM):
        out[k] = 0.0
    if T10k > 0 and not caught:
        out[M_S] = 2.0 ** (-T10k / 12.0)
        out[M_H6] = 1.0 if T10k <= 6 else 0.0
        out[M_H12] = 1.0 if T10k <= 12 else 0.0
        out[M_H24] = 1.0 if T10k <= 24 else 0.0
        out[M_H60] = 1.0 if T10k <= 60 else 0.0
        out[M_H120] = 1.0
        out[M_T10K] = T10k
    out[M_DUR] = 1.0 if (dur_sum / 6.0 >= 10000.0 and not caught) else 0.0
    out[M_PUNI] = pu
    out[M_LOGW] = math.log10(max(wealth, 1000.0))
    out[M_CAT] = 1.0 if caught else 0.0
    out[M_QUIT] = 1.0 if (quit and not caught) else 0.0
    out[M_VAL] = val
    out[M_I12] = inc12
    out[M_I24] = inc24
    out[M_I60] = inc60
    out[M_SEED] = 1.0 if raised_seed else 0.0
    out[M_PUNI_SEED] = pu if raised_seed else 0.0
    out[M_V100M] = 1.0 if val >= 1e8 else 0.0
    out[M_PRODALIVE] = prod_alive
    out[M_DUR2] = 0.0 if caught else months_10k / (T - 36.0)


@njit(parallel=True, cache=True)
def evaluate(genomes, U, Z, UI, ZI, ENG, SEC, W):
    """Simule chaque génome sur les M mêmes « destins » aléatoires (nombres aléatoires communs)."""
    P = genomes.shape[0]
    M = U.shape[0]
    out = np.zeros((P, M, NM))
    dummy = np.zeros((1, 1))
    for i in prange(P * M):
        p = i // M
        m = i % M
        sim_one(genomes[p], U[m], Z[m], UI[m], ZI[m], ENG, SEC, W, out[p, m], dummy, False)
    return out


@njit(parallel=True, cache=True)
def evaluate_sums(genomes, U, Z, UI, ZI, ENG, SEC, W):
    """Comme evaluate, mais ne renvoie que les sommes par génome (beaucoup moins de mémoire)."""
    P = genomes.shape[0]
    M = U.shape[0]
    sums = np.zeros((P, NM))
    dummy = np.zeros((1, 1))
    for p in prange(P):
        row = np.zeros(NM)
        for m in range(M):
            sim_one(genomes[p], U[m], Z[m], UI[m], ZI[m], ENG, SEC, W, row, dummy, False)
            for k in range(NM):
                sums[p, k] += row[k]
    return sums


@njit(cache=True)
def _canon_row(g, ENG):
    # Gènes sans effet remis à une valeur unique, pour reconnaître deux stratégies identiques en pratique.
    if g[G_THR12] == 0 and g[G_DL12] == 8 and g[G_E2] != g[G_E1]:
        g[G_E2] = g[G_E1]
        g[G_E3] = g[G_E1]
    if g[G_E2] == g[G_E1]:
        g[G_THR12] = 0
        g[G_DL12] = 8
    if g[G_THR23] == 0 and g[G_DL23] == 8 and g[G_E3] != g[G_E2]:
        g[G_E3] = g[G_E2]
    if g[G_E3] == g[G_E2]:
        g[G_THR23] = 0
        g[G_DL23] = 8
    path = np.empty(3, dtype=np.int64)
    n = 1
    path[0] = g[G_E1]
    if g[G_E2] != path[0]:
        path[n] = g[G_E2]
        n += 1
    if g[G_E3] != path[n - 1]:
        path[n] = g[G_E3]
        n += 1
    has_prod = False
    uses_channel = False
    uses_sector = False
    uses_price = False
    uses_reinv = False
    uses_niche = False
    keep_ok = False
    for i in range(n):
        e = path[i]
        f = FAMILY[e]
        if f == F_PROD:
            has_prod = True
            uses_channel = True
            uses_price = True
            uses_reinv = True
            uses_niche = True
            if ENG[e, P_B2B] > 0.5 or e == E_MARKET or ENG[e, P_CEIL] < 0.0:
                uses_sector = True
        elif f == F_AGENCY or f == F_SVC:
            uses_channel = True
            uses_sector = True
            uses_price = True
            uses_reinv = True
            uses_niche = True
        elif f == F_FREE:
            uses_channel = True
            uses_sector = True
            uses_price = True
        elif f == F_JOB:
            uses_sector = True
        elif f == F_INFO:
            uses_channel = True
            uses_price = True
            uses_reinv = True
            uses_niche = True
        elif f == F_ECOM:
            uses_price = True
            uses_reinv = True
        elif f == F_FLIP:
            uses_reinv = True
        elif f == F_CONTENT or f == F_AUD:
            uses_niche = True
        elif f == F_CLOSER or f == F_TRADING:
            uses_price = True
        if i + 1 < n and (f == F_AGENCY or (f == F_SVC and SVC[e, SV_HOURLY] < 0.5)) and FAMILY[path[i + 1]] == F_PROD:
            keep_ok = True
    if not has_prod:
        g[G_FUND] = 0
        if g[G_COF] == 1:
            g[G_COF] = 0
        if g[G_GEO] == 1 or g[G_GEO] == 2:
            g[G_GEO] = 0
    if g[G_FUND] == 0:
        g[G_RAISE] = 0
    if not keep_ok:
        g[G_KEEP] = 0
    if not uses_channel:
        g[G_CHANNEL] = 0
    if not uses_sector:
        g[G_SECTOR] = 0
    if not uses_price:
        g[G_PRICE] = 0
    if not uses_reinv:
        g[G_REINV] = 0
    if not uses_niche:
        g[G_NICHE] = 0


@njit(cache=True)
def canonicalize_nb(G, ENG):
    out = G.copy()
    for i in range(out.shape[0]):
        _canon_row(out[i], ENG)
    return out


TRACE_COLS = ["revenu total", "moteur", "clients", "MRR", "tech", "vente", "connaissance métier", "audience",
              "retainers", "stade VC", "associé", "qualité entreprise", "temps plein", "cash perso",
              "stock+audience+placements", "abandon"]


def trace_one(g, seed=0, W=None, ENG=None, SEC=None):
    rng = np.random.default_rng(seed)
    U, Z, UI, ZI = draw_randoms(rng, 1)
    out = np.zeros(NM)
    tr = np.zeros((T_MONTHS, len(TRACE_COLS)))
    sim_one(np.asarray(g, dtype=np.int64), U[0], Z[0], UI[0], ZI[0], ENG, SEC, W, out, tr, True)
    return out, tr


def draw_randoms(rng, M, T=T_MONTHS):
    return (rng.random((M, T, KU)), rng.standard_normal((M, T, KZ)),
            rng.random((M, KI)), rng.standard_normal((M, KI)))
