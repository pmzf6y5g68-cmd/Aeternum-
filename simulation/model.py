"""
Simulateur Monte-Carlo : une vie d'entrepreneur, mois par mois, pendant 10 ans.

Profil de départ : seul, jeune, sans expérience, en France, ~1 500 € d'épargne
(log-normale), 900 €/mois de dépenses de vie. Le talent, la ténacité, le capital
de départ et la chance sont tirés au hasard pour chaque vie simulée.

Une stratégie = un génome de 20 gènes (jusqu'à 3 phases de moteurs de revenus,
déclencheurs de transition, secteur, canal, prix, heures, financement...).
"""
import math
import numpy as np
from numba import njit, prange

T_MONTHS = 120
KU = 18  # tirages uniformes / mois
KZ = 8   # tirages gaussiens / mois
KI = 12  # tirages initiaux / vie
NM = 21  # métriques / vie

(G_E1, G_E2, G_E3, G_THR12, G_DL12, G_THR23, G_DL23, G_SECTOR, G_CHANNEL,
 G_CONTENT, G_PRICE, G_HOURS, G_LEARN, G_REINV, G_FUND, G_RAISE, G_GEO,
 G_COF, G_NICHE, G_KEEP) = range(20)
NG = 20
GENE_CARD = np.array([15, 15, 15, 8, 9, 8, 9, 14, 6, 4, 4, 6, 4, 4, 4, 4, 4, 3, 2, 2], dtype=np.int64)
GENE_NAMES = ["moteur 1", "moteur 2", "moteur 3", "seuil 1→2", "délai 1→2", "seuil 2→3",
              "délai 2→3", "secteur", "canal", "part contenu", "prix", "heures/sem",
              "apprentissage", "réinvestissement", "financement", "déclencheur levée",
              "géographie", "associé", "niche", "garder l'agence"]

(E_JOB, E_FREE, E_AGENCY, E_CLOSER, E_MICRO, E_VERTAI, E_CONSUMER, E_MARKET,
 E_FINTECH, E_DEEPTECH, E_ECOM, E_CONTENT, E_INFO, E_TRADING, E_FRAUD) = range(15)
NE = 15

THR = np.array([1e18, 2000., 4000., 6000., 10000., 15000., 25000., 50000.])
DLN = np.array([3., 6., 9., 12., 18., 24., 36., 48., 1e9])
CONTENT_SH = np.array([0.0, 0.10, 0.20, 0.35])
HOURS = np.array([35., 45., 55., 65., 75., 90.])
LEARN = np.array([0.0, 0.10, 0.25, 0.50])
REINV = np.array([0.0, 0.25, 0.50, 0.80])
RAISE_TRIG = np.array([0.0, 100e3, 400e3, 1.5e6])

(W_SERV, W_PMF, W_GROWTH, W_VC, W_MULT, W_CHURN, W_CONTENT, W_CLOSER,
 W_ECOM, W_BURN, W_COMMOD, W_INSEXP, W_TRADE, W_FRAUD) = range(14)
NW = 14

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
TIER_PRICE_PROD = np.array([[0.5, 1.0, 2.0, 4.0],    # B2B IA
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
# multiplicateurs d'acquisition produit par canal [B2C, B2B]
CHP = np.array([[0.15, 1.0], [0.9, 0.8], [1.0, 0.5], [0.4, 1.1], [1.1, 0.6], [0.6, 0.8]])
GEO_CEIL = np.array([0.07, 0.28, 1.0])
GEO_VC = np.array([0.8, 0.9, 1.15])
GEO_MULT = np.array([0.8, 0.9, 1.1])
GEO_ARPU = np.array([1.0, 1.05, 1.35])
LOG_UNICORN = math.log10(0.925e9)  # 1 milliard de dollars ≈ 0,925 milliard d'euros


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
    return e >= E_MICRO and e <= E_DEEPTECH


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
    # ---------------- profil du fondateur
    talent = math.exp(0.35 * ZI[0])
    tal_l = math.sqrt(talent)
    tal_c = talent ** 0.6
    grit = 0.5 + 0.5 * UI[0]
    cash = 1500.0 * math.exp(0.6 * ZI[1])
    tech = 0.08 + 0.08 * UI[1]
    sales = 0.08 + 0.08 * UI[2]
    cskill = 0.08 + 0.08 * UI[3]
    network = 0.03 + 0.04 * UI[4]
    alpha = -0.012 + 0.0085 * ZI[2] + W[W_TRADE]
    cof_is_tech = UI[5] < 0.5
    cof_skill = 0.35 + 0.45 * UI[6]
    living = 900.0
    insight = 0.0
    cins = 0.05
    rep = 0.0
    audience = 50.0
    ctal = math.exp(0.8 * ZI[7] - 0.32)  # talent de créateur : la plupart stagnent, quelques-uns explosent
    sq = math.exp(0.7 * ZI[8] - 0.245)   # chance/qualité propre à l'activité de services (niche, timing, réputation)

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

    # Pencavel (2014) : au-delà de ~50 h/semaine la production n'augmente presque plus
    eff_week = H if H <= 50.0 else 50.0 + 0.35 * min(H - 50.0, 20.0)
    eff_base = eff_week * 4.33

    geo_level = 2 if geo_gene == 3 else 0
    geo_final = 0
    if geo_gene == 1:
        geo_final = 1
    elif geo_gene >= 2:
        geo_final = 2
    svc_geo_price = 1.3 if geo_gene == 3 else 1.0

    # ---------------- état
    eng = g[G_E1]
    phase = 0
    phase_t0 = 0
    pstreak = 0
    served = 0.0
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
        income = 0.0
        milestone = False
        mrr_12 = hist[t % 12] if t >= 12 else 0.0
        mrr_3 = hist[(t - 3) % 12] if t >= 3 else 0.0
        active = False

        if prison_until > t:
            income = 0.0
        elif quit:
            income = fallback_inc * (1.0 + 0.02 * t / 12.0)
            cash += income - living
        else:
            active = True
            # ---------------- heures et énergie
            eff = eff_base
            if burn_timer > 0:
                burn_timer -= 1
                eff *= 0.15
            else:
                over = (H - 50.0) / 10.0
                if over > 0.0:
                    hz = 0.012 * W[W_BURN] * over ** 1.6
                    if u[0] < hz:
                        burn_timer = 2 + int(u[16] * 3.0)
                        eff *= 0.15
                        retainers *= 0.85
                        if u[16] < 0.12:
                            quit = True  # épuisement : on arrête tout
            side_inc = 0.0
            if cash < -2000.0 and not (eng == E_JOB and employed):
                eff = max(eff - 85.0, 20.0)
                side_inc = 1000.0
            cofh = 0.8 * min(eff_base, 50.0 * 4.33) if has_cof else 0.0
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
            ins_h = 0.0
            intensity = 1.0
            growth_ok = True
            b2b_prod = False

            # ================= MOTEURS =================
            if eng == E_JOB:
                growth_ok = False
                if not employed:
                    tech_h = work * 0.8
                    sales_h = work * 0.1
                    p_h = (-0.08 + 0.55 * tech_e + 0.15 * sales_e + 0.1 * network) * 0.75
                    if p_h > 0.45:
                        p_h = 0.45
                    if p_h > 0.0 and u[2] < p_h:
                        employed = True
                        milestone = True
                        salary0 = 2000.0 + 1500.0 * tech
                else:
                    emp_months += 1
                    rev = min(7000.0, salary0 * (1.0 + 0.07 * emp_months / 12.0))
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
                win = (0.006 + 0.05 * fr_rep + 0.025 * tech_e) * FR_TWIN[tier] * tal_c * W[W_SERV] * chm * geo_w * sq
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
                    * (1.1 if narrow else 1.0) * W[W_SERV]
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
                rep = min(1.0, rep * 0.995 + 0.03 * new_cl * (0.4 + tech_e))
                cost += 150.0 + 25.0 * retainers
                tech_h = min(need, cap_h) + 0.5 * ret_h
                if tech_h > avail:
                    tech_h = avail
                ins_h = tech_h + 0.3 * sales_h

            elif eng == E_CLOSER:
                growth_ok = False
                if not has_gig:
                    pg = (0.25 + 0.5 * sales_e) * W[W_CLOSER]
                    if u[2] < pg:
                        has_gig = True
                        milestone = True
                    sales_h = 0.3 * work
                if has_gig:
                    calls = min(100.0, 0.55 * work) * 0.6 * math.exp(0.35 * z[5] - 0.06) * min(sq, 1.5)
                    gate = 1.0
                    if tier >= 2:
                        gate = min(1.0, sales_e / 0.45)
                    crt = (0.05 + 0.27 * sales_e) * CL_TCLOSE[tier] * gate * math.sqrt(talent)
                    rev = calls * crt * CL_COMM[tier] * W[W_CLOSER]
                    sales_h = calls * 1.5
                    intensity = 1.4
                    if u[3] < 0.08:
                        has_gig = False
                cost = 50.0
                network += 0.004 * (1.0 - network)

            elif eng >= E_MICRO and eng <= E_DEEPTECH:
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
                        if u[2] < ph:
                            pmf = True
                            pmf_t = t
                            milestone = True
                            cq = min(6.0, math.exp(1.0 * ZI[3 + (n_prod % 4)] - 0.5))
                    elif u[15] < 0.02:
                        cq *= 0.5  # choc : concurrent, nouveau modèle d'IA qui rend le produit banal
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
                    arpu = ENG[eng, P_ARPU] * TIER_PRICE_PROD[int(ENG[eng, P_ELAST]), tier] * GEO_ARPU[geo_level]
                    if b2b_prod:
                        arpu *= wtp
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
                        acq *= (1.3 if narrow else 1.0) * (0.6 + 0.6 * mat)
                    if channel == 2:
                        if funded_now:
                            ab = 0.25 * burn
                        else:
                            ab = reinv * max(last_profit, 0.0) * 0.5
                            if cash > 3000.0:
                                ab += 200.0
                        # le coût d'acquisition grimpe quand on dépense plus (on épuise les meilleurs prospects)
                        cac = arpu * ENG[eng, P_PAYBACK] / (0.5 + mkt) * (1.0 + math.sqrt(ab / 50000.0))
                        acq += ab / cac * CHP[2, bi]
                        cost += ab
                    # audience → clients : freiné par le prix et par la pertinence de l'audience (décideurs du secteur)
                    if b2b_prod:
                        acq += audience * 0.0002 * el * (0.4 if narrow else 0.15)
                    else:
                        acq += audience * 0.0006 * el
                    if not pmf:
                        acq *= 0.35
                    else:
                        acq *= cq
                    acq *= math.exp(0.35 * z[1] - 0.06) * sat
                    gb = 1.0 + 0.12 * stage + (0.2 if has_cof else 0.0)
                    size_f = 1.0 / (1.0 + (12.0 * mrr / 1e6) ** 0.6)
                    org = customers * ENG[eng, P_GORG] * W[W_GROWTH] * ((cq * size_f) if pmf else 0.15) * sat * gb \
                        * math.sqrt(min(1.0, el))
                    if t < exp_pen_until:
                        org *= 0.8
                    chn = customers * ENG[eng, P_CHURN] * W[W_CHURN] * (1.0 if pmf else 2.0) * (1.3 - 0.6 * quality) \
                        * churn_mult * TIER_CHURN[tier]
                    customers += acq + org - chn
                    if customers < 0.0:
                        customers = 0.0
                    mrr = customers * arpu
                    rev = mrr
                    cost += mrr * (1.0 - margin) + 100.0
                    if not funded_now:
                        cost += 0.2 * max(mrr - 3000.0, 0.0)  # support, service client, salariés : la structure suit le CA
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
                    team_f = 1.6 if has_cof else 0.7
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
                cskill += 0.03 * (1.0 - cskill)
                if not winner:
                    tb = (cash - 500.0) * 0.4
                    if tb > 1200.0:
                        tb = 1200.0
                    if tb >= 100.0:
                        cost = tb + 60.0
                        rev = tb * 0.5
                        pw = 0.04 * (0.3 + 0.7 * mkt) * math.sqrt(talent) * W[W_ECOM] * (0.7 if tier == 3 else 1.0) \
                            * min(1.3, math.sqrt(tb / 600.0))
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
                    * math.exp(0.3 * z[6] - 0.045)
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
                side_inc = 1100.0
                tr_skill = min(0.004, tr_skill + 0.0002)

            else:  # E_FRAUD — témoin, voir README
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


            # ---------------- comptabilité
            if _is_product(eng) and stage >= 1 and not dead_company:
                # risques non modélisés en détail : conflit d'associés, procès, mauvaise exécution, marché qui s'effondre
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
                if growth_ok and profit > 0.0:
                    gs = reinv * profit
                team_h = gs / 45.0
                income = profit - gs
                if has_cof and not (eng == E_JOB or eng == E_CLOSER or eng == E_TRADING or eng == E_FRAUD):
                    income *= 0.55
                last_profit = profit
            last_rev = rev
            cash += income + side_inc - living

            # ---------------- compétences
            tech += 0.025 * tal_l * tech_h / 100.0 * (1.0 - tech) + 0.04 * tal_l * 0.6 * learn_h / 100.0 * (1.0 - tech)
            sales += 0.035 * intensity * tal_l * sales_h / 100.0 * (1.0 - sales) \
                + 0.04 * tal_l * 0.4 * learn_h / 100.0 * (1.0 - sales)
            insight += 0.035 * tal_l * ins_h / 100.0 * (1.0 - insight)
            cskill += 0.04 * tal_l * content_h / 100.0 * (1.0 - cskill)
            if tech > 0.99:
                tech = 0.99
            if sales > 0.99:
                sales = 0.99
            if insight > 0.99:
                insight = 0.99
            if cskill > 0.99:
                cskill = 0.99
            # ---------------- audience
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


        # ---------------- justice : détection tardive (prescription des délits : 6 ans), même après un abandon
        if (not caught) and fraud_expo_until > t and not (active and eng == E_FRAUD) \
                and u[9] < 0.012 * W[W_FRAUD]:
            caught = True
        if caught and prison_until < 0:
            prison_until = t + 24 + int(24.0 * u[12])
            cash = -50000.0
            quit = True
            fallback_inc = 1300.0
            income = 0.0

        # ---------------- suivi de l'objectif 10 k€/mois
        if income >= 10000.0:
            streak += 1
        else:
            streak = 0
        if streak >= 3 and T10k < 0:
            T10k = t + 1
        if t == 11:
            inc12 = income
        elif t == 23:
            inc24 = income
        elif t == 59:
            inc60 = income
        if t >= 54 and t < 60:
            dur_sum += income
        if t >= 36 and income >= 10000.0:
            months_10k += 1.0
        hist[t % 12] = mrr
        if do_trace:
            trace[t, 0] = income
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
            trace[t, 12] = 1.0 if pmf else 0.0
            trace[t, 13] = cash
            trace[t, 14] = company_cash
            trace[t, 15] = 1.0 if quit else 0.0

        if active and not quit:
            # ---------------- transitions de phase
            for _k in range(2):
                if phase >= 2:
                    break
                nxt = g[G_E2] if phase == 0 else g[G_E3]
                if nxt == eng:
                    phase += 1
                    continue
                thr = THR[g[G_THR12]] if phase == 0 else THR[g[G_THR23]]
                dl = DLN[g[G_DL12]] if phase == 0 else DLN[g[G_DL23]]
                if income >= thr:
                    pstreak += 1
                else:
                    pstreak = 0
                if pstreak >= 3 or (t + 1 - phase_t0) >= dl:
                    old = eng
                    eng = nxt
                    phase += 1
                    phase_t0 = t + 1
                    pstreak = 0
                    new_b2b = _is_product(eng) and ENG[eng, P_B2B] > 0.5
                    if old == E_AGENCY:
                        if _is_product(eng) and keep:
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
                    elif old == E_FREE and new_b2b:
                        warm = 0.05 * served
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
                    if old == E_JOB:
                        employed = False
                    if old == E_CLOSER:
                        has_gig = False
                    if old == E_ECOM:
                        winner = False
                        adspend = 0.0
                break
            # ---------------- motivation / abandon
            if mrr > best_mrr * 1.2 + 50.0:
                best_mrr = mrr
                milestone = True
            if milestone or income > best_inc * 1.1 + 200.0:
                stagnation = 0
            else:
                stagnation += 1
            if income > best_inc:
                best_inc = income
            if not (eng == E_JOB and employed):
                comfort = 1.0
                if income >= 6000.0:
                    comfort = 0.05
                elif income >= 2500.0:
                    comfort = 0.2
                qh = (0.004 + 0.03 * min(1.0, stagnation / 12.0)) * (1.6 - grit) * comfort
                if u[1] < qh:
                    quit = True
            if cash < -6000.0:
                quit = True
            if eng == E_TRADING and cash < 100.0:
                quit = True
            if dead_company and _is_product(eng):
                quit = True
            if quit:
                fallback_inc = min(4000.0, 1400.0 + 2600.0 * max(tech, sales))

    # ---------------- bilan à 10 ans
    val = 0.0
    pu = 0.0
    prod_alive = 0.0
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
            val = arr * m * moat * GEO_MULT[geo_level] * heat_f * W[W_MULT]
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
            vf = max(val, af * m2 * moat * GEO_MULT[gl] * heat_f * W[W_MULT])
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
    wealth = cash + ownership * val * 0.6

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


TRACE_COLS = ["revenu", "moteur", "clients", "MRR", "tech", "vente", "connaissance métier", "audience",
              "retainers", "stade VC", "associé", "qualité entreprise", "PMF", "cash perso", "cash entreprise", "abandon"]


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
