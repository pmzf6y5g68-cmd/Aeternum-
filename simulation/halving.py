"""
Sélection « on coupe, on relance » (successive halving avec mutations) sur les stratégies candidates.

À chaque étape, toutes les stratégies du lot sont évaluées sur les MÊMES destins aléatoires (nombres
aléatoires communs) avec un budget de vies croissant. On coupe celles qui valent le moins et on relance
les autres par mutation de un ou deux gènes. Les dernières survivantes sont évaluées sur 300 000 vies,
puis dans des mondes perturbés : on garde celle qui est la plus solide en moyenne sur les mondes.

Critère (--objectif, par défaut « vitesse_valeur ») :
  - vitesse : probabilité d'avoir atteint 10 k€/mois (3 mois de suite), pondérée par un poids qui décroît
    avec le temps, exp(−t / 36 mois). Une arrivée à 2 ans compte plus qu'une arrivée à 10 ans ;
  - valorisation : multiplicateur de 1 (aucune chance de licorne) à 2 (0,5 % de chance ou plus) ;
  - score = vitesse × valorisation. Une stratégie qui dépasse 2 % de risque de catastrophe est éliminée.
  - « utilite » : critère du projet (0,45 vitesse + 0,30 licorne + 0,25 pérennité), pour comparaison.

Contrainte d'effort : --hstart-max borne les heures de départ, pendant toute la première année
(0 = 5 h/semaine, 1 = 10 h, 2 = 15 h, 3 = 20 h). Les graines sont réparées : chaque bonne stratégie
existante est reprise avec des heures de départ bornées.

Usage :
    python3 halving.py med --hstart-max 1 --tag med_10h
    python3 halving.py generic --hstart-max 1 --tag generic_10h
    python3 halving.py med --hstart-max 1 --tag test --rapide   # essai de bon fonctionnement
"""
import argparse
import json
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

ap = argparse.ArgumentParser()
ap.add_argument("modele", choices=["med", "generic"])
ap.add_argument("--hstart-max", type=int, default=3)
ap.add_argument("--objectif", choices=["vitesse_valeur", "utilite"], default="vitesse_valeur")
ap.add_argument("--tag", required=True)
ap.add_argument("--seed", type=int, default=2026)
ap.add_argument("--mondes", type=int, default=12)
ap.add_argument("--rapide", action="store_true", help="budgets réduits (essai de bon fonctionnement)")
a = ap.parse_args()

if a.modele == "med":
    import model_med as M
    import evolve2_med as E
    SRC = ["med_main1.json"]
else:
    import model as M
    import evolve2 as E
    SRC = ["v2_main1.json", "v2_locked.json"]

from params import ENG, SEC, WORLD_NOMINAL  # noqa: E402

RES = os.path.join(HERE, "results")
rng = np.random.default_rng(a.seed)
T0 = time.time()
ECHELLE = 0.01 if a.rapide else 1.0

# (vies par stratégie, part gardée, enfants par survivante)
STAGES = [(20_000, 0.25, 3), (60_000, 0.30, 3), (200_000, 0.35, 2)]
# points de la courbe cumulée (mois) ; la dernière valeur est la fin de l'horizon du modèle
T_CUM = [0.0, 6.0, 12.0, 24.0, 60.0, float(M.T_MONTHS)]
TAU = 36.0  # mois : poids décroissant de la vitesse
GRILLE = np.arange(0.0, float(M.T_MONTHS) + 1.0, 1.0)
POIDS = np.exp(-GRILLE / TAU)
POIDS_SOMME = POIDS.sum()


def load(name):
    return json.load(open(os.path.join(RES, name), encoding="utf-8"))


def lives(n):
    return max(300, int(n * ECHELLE))


def seeds():
    out = []
    for name in SRC:
        d = load(name)
        if "final" in d:
            out += [r["strategie"]["genome"] for r in d["final"]]
        if "log" in d:
            out += [e["best_genome"] for e in d["log"] if "best_genome" in e]
        if "engines" in d:
            for v in d["engines"].values():
                out += [r["strategie"]["genome"] for r in v["final"]]
    # réparation : chaque bonne stratégie reprise avec des heures de départ bornées
    rep = []
    for g in out:
        for h in range(a.hstart_max + 1):
            x = [int(v) for v in g]
            x[M.G_HSTART] = h
            rep.append(x)
    return rep


def canon_unique(rows):
    if len(rows) == 0:
        return np.zeros((0, M.NG), dtype=np.int64)
    G = E.canon(np.array(rows, dtype=np.int64))
    G = G[G[:, M.G_HSTART] <= a.hstart_max]
    seen, out = set(), []
    for g in G:
        k = tuple(int(x) for x in g)
        if k not in seen:
            seen.add(k)
            out.append(g)
    return np.array(out, dtype=np.int64).reshape(-1, M.NG)


def mutate(G, n_child, r):
    out = []
    for _ in range(n_child):
        g = G[int(r.integers(len(G)))].copy()
        for _ in range(int(r.integers(1, 3))):
            i = int(r.integers(M.NG))
            g[i] = int(r.integers(M.GENE_CARD[i]))
        out.append(g)
    return np.array(out, dtype=np.int64).reshape(-1, M.NG)


def stats(G, n, seed, world=WORLD_NOMINAL):
    r = np.random.default_rng(seed)
    acc = np.zeros((len(G), M.NM))
    done = 0
    while done < n:
        m = min(25_000, n - done)
        U, Z, UI, ZI = M.draw_randoms(r, m)
        acc += M.evaluate_sums(G, U, Z, UI, ZI, ENG, SEC, world)
        done += m
    return acc / n


def vitesse(P):
    """P : (n, 6) probabilités cumulées aux points T_CUM. Renvoie la vitesse pondérée (n,)."""
    out = np.zeros(len(P))
    for i in range(len(P)):
        out[i] = (np.interp(GRILLE, T_CUM, P[i]) * POIDS).sum() / POIDS_SOMME
    return out


def score(st):
    """Score par stratégie (plus haut = meilleur), à partir des moyennes issues de stats()."""
    if a.objectif == "utilite":
        return E.utility(st)
    P = np.stack([np.zeros(len(st)), st[:, M.M_H6], st[:, M.M_H12], st[:, M.M_H24],
                  st[:, M.M_H60], st[:, M.M_H120]], axis=1)
    spd = vitesse(P)
    valeur = 1.0 + np.minimum(1.0, st[:, M.M_PUNI] / 0.005)
    ok = st[:, M.M_CAT] <= 0.02
    return np.where(ok, spd * valeur, spd - 1.0)


def score_rec(r):
    """Même score à partir d'un enregistrement d'évaluation profonde."""
    if a.objectif == "utilite":
        return r["utilite"]
    s = r["stats"]
    P = np.array([[0.0, s["p10k_6m"], s["p10k_12m"], s["p10k_24m"], s["p10k_60m"], s["p10k_120m"]]])
    spd = float(vitesse(P)[0])
    if s["p_catastrophe"] > 0.02:
        return spd - 1.0
    return spd * (1.0 + min(1.0, s["p_licorne"] / 0.005))


def chemin(g):
    return " → ".join(E.ENGINES_SHORT[x] for x in E.path_of(g))


def main():
    base = canon_unique(seeds())
    print(f"graines valides (effort ≤ {a.hstart_max}) : {len(base)} | objectif : {a.objectif}", flush=True)
    mut = canon_unique(mutate(base, max(40, int(400 * ECHELLE)), rng))
    pool = canon_unique(list(base) + list(mut))
    print(f"lot initial : {len(pool)} stratégies", flush=True)

    etapes = []
    for si, (n0, frac, kids) in enumerate(STAGES):
        n = lives(n0)
        st = stats(pool, n, seed=100 + si)
        sc = score(st)
        order = np.argsort(-sc)
        n_keep = max(10, int(round(len(pool) * frac)))
        best = order[0]
        etapes.append({
            "etape": si + 1, "vies_par_strategie": n, "strategies": int(len(pool)),
            "coupees": int(len(pool) - n_keep), "gardees": int(n_keep),
            "relancees_par_mutation": int(min(400, n_keep * kids)) if si < len(STAGES) - 1 else 0,
            "score_meilleure": round(float(sc[best]), 5), "score_mediane": round(float(np.median(sc)), 5),
            "p10k_24m_meilleure_pct": round(float(st[best, M.M_H24]) * 100, 2),
            "p10k_60m_meilleure_pct": round(float(st[best, M.M_H60]) * 100, 2),
            "licorne_meilleure_pct": round(float(st[best, M.M_PUNI]) * 100, 3),
            "meilleure_genome": [int(x) for x in pool[best]],
        })
        e = etapes[-1]
        print(f"étape {e['etape']} ({n} vies) : {e['strategies']} stratégies, coupées {e['coupees']}, "
              f"gardées {e['gardees']} | meilleure score {e['score_meilleure']:.4f} "
              f"≤24m {e['p10k_24m_meilleure_pct']:.2f} % ≤60m {e['p10k_60m_meilleure_pct']:.2f} % "
              f"licorne {e['licorne_meilleure_pct']:.3f} % | {chemin(pool[best])}", flush=True)
        if si < len(STAGES) - 1:
            kids_g = mutate(pool[order[:n_keep]], min(400, n_keep * kids), rng)
            pool = canon_unique(list(pool[order[:n_keep]]) + list(kids_g))
            print(f"  relancées : {len(kids_g)} variantes ; lot suivant : {len(pool)}", flush=True)

    top = pool[order[:8]]
    print("évaluation finale : 300 000 vies, monde nominal", flush=True)
    final = E.deep_eval(top, lives=max(3000, int(300_000 * ECHELLE)), seed=999)
    for r in final:
        r["score"] = round(float(score_rec(r)), 5)
    final.sort(key=lambda r: -r["score"])

    rw = np.random.default_rng(a.seed + 1000)
    worlds = [E.perturbed_world(rw) for _ in range(a.mondes)]
    by_world = np.zeros((len(top), a.mondes))
    for k, w in enumerate(worlds):
        by_world[:, k] = score(stats(top, lives(60_000), seed=500 + k, world=w))
    moyenne = by_world.mean(axis=1)
    minimum = by_world.min(axis=1)
    print("mondes perturbés (score moyen / minimum) :", flush=True)
    for i in np.argsort(-moyenne):
        print(f"  {chemin(top[i]):70s} moy {moyenne[i]:.4f} min {minimum[i]:.4f}", flush=True)

    champ = int(np.argmax(moyenne))
    champion_g = [int(x) for x in top[champ]]
    print("CHAMPION :", chemin(top[champ]), "| genome", champion_g, flush=True)

    rows = []
    for i in np.argsort(-moyenne):
        rows.append({"genome": [int(x) for x in top[i]], "parcours": chemin(top[i]),
                     "score_moyen_mondes": round(float(moyenne[i]), 5),
                     "score_min_mondes": round(float(minimum[i]), 5),
                     "score_par_monde": [round(float(x), 5) for x in by_world[i]]})
    E.save(f"halving_{a.tag}.json", {
        "params": vars(a), "modele": a.modele, "objectif": a.objectif, "etapes": etapes,
        "champion_genome": champion_g, "final": final, "mondes": rows,
        "vies_total": int(sum(e["vies_par_strategie"] * e["strategies"] for e in etapes)
                          + max(3000, int(300_000 * ECHELLE)) * len(top) + lives(60_000) * len(top) * a.mondes),
        "secondes": time.time() - T0,
    })
    print(f"terminé en {time.time() - T0:.0f} s", flush=True)


if __name__ == "__main__":
    main()
