"""
Sélection « on coupe, on relance » (successive halving avec mutations) sur les stratégies candidates.

À chaque étape, toutes les stratégies du lot sont évaluées sur les MÊMES destins aléatoires (nombres
aléatoires communs) avec un budget de vies croissant. On coupe celles qui rapportent le moins et on
relance les autres en produisant des variantes (mutation d'un ou deux gènes). Les dernières survivantes
sont évaluées sur 300 000 vies, puis dans 12 mondes perturbés : on garde celle qui est la plus solide
en moyenne sur les mondes.

Contrainte d'effort : le gène « heures au début » est borné par --hstart-max
(0 = 5 h/semaine, 1 = 10 h, 2 = 15 h, 3 = 20 h), pendant toute la première année.

Usage :
    python3 halving.py med --hstart-max 1 --tag med_10h
    python3 halving.py generic --hstart-max 1 --tag generic_10h
"""
import argparse
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

ap = argparse.ArgumentParser()
ap.add_argument("modele", choices=["med", "generic"])
ap.add_argument("--hstart-max", type=int, default=3)
ap.add_argument("--tag", required=True)
ap.add_argument("--seed", type=int, default=2026)
ap.add_argument("--mondes", type=int, default=12)
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

# (vies par stratégie, part gardée, enfants par survivante)
STAGES = [(20_000, 0.25, 3), (60_000, 0.30, 3), (200_000, 0.35, 2)]


def load(name):
    import json
    return json.load(open(os.path.join(RES, name), encoding="utf-8"))


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
    return out


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


def stats(G, lives, seed, world=WORLD_NOMINAL):
    r = np.random.default_rng(seed)
    acc = np.zeros((len(G), M.NM))
    done = 0
    while done < lives:
        m = min(25_000, lives - done)
        U, Z, UI, ZI = M.draw_randoms(r, m)
        acc += M.evaluate_sums(G, U, Z, UI, ZI, ENG, SEC, world)
        done += m
    return acc / lives


def main():
    base = canon_unique(seeds())
    print(f"graines valides (effort ≤ {a.hstart_max}) : {len(base)}", flush=True)
    mut = canon_unique(mutate(base, 400, rng))
    pool = canon_unique(list(base) + list(mut))
    print(f"lot initial : {len(pool)} stratégies", flush=True)

    etapes = []
    for si, (lives, frac, kids) in enumerate(STAGES):
        st = stats(pool, lives, seed=100 + si)
        u = E.utility(st)
        order = np.argsort(-u)
        n_keep = max(10, int(round(len(pool) * frac)))
        best = order[0]
        etapes.append({
            "etape": si + 1, "vies_par_strategie": lives, "strategies": int(len(pool)),
            "coupees": int(len(pool) - n_keep), "gardees": int(n_keep),
            "relancees_par_mutation": int(min(400, n_keep * kids)) if si < len(STAGES) - 1 else 0,
            "utilite_meilleure": round(float(u[best]), 4), "utilite_mediane": round(float(np.median(u)), 4),
            "p10k_24m_meilleure_pct": round(float(st[best, M.M_H24]) * 100, 2),
            "p10k_60m_meilleure_pct": round(float(st[best, M.M_H60]) * 100, 2),
            "meilleure_genome": [int(x) for x in pool[best]],
        })
        e = etapes[-1]
        print(f"étape {e['etape']} ({lives} vies) : {e['strategies']} stratégies, coupées {e['coupees']}, "
              f"gardées {e['gardees']} | meilleure util {e['utilite_meilleure']:+.4f} "
              f"≤24m {e['p10k_24m_meilleure_pct']:.2f} % ≤60m {e['p10k_60m_meilleure_pct']:.2f} % "
              f"| {' → '.join(E.ENGINES_SHORT[x] for x in E.path_of(pool[best]))}", flush=True)
        if si < len(STAGES) - 1:
            kids_g = mutate(pool[order[:n_keep]], min(400, n_keep * kids), rng)
            pool = canon_unique(list(pool[order[:n_keep]]) + list(kids_g))
            print(f"  relancées : {len(kids_g)} variantes ; lot suivant : {len(pool)}", flush=True)

    top = pool[order[:8]]
    print("évaluation finale : 300 000 vies, monde nominal", flush=True)
    final = E.deep_eval(top, lives=300_000, seed=999)
    final.sort(key=lambda r: -r["utilite"])

    rw = np.random.default_rng(a.seed + 1000)
    worlds = [E.perturbed_world(rw) for _ in range(a.mondes)]
    by_world = np.zeros((len(top), a.mondes))
    for k, w in enumerate(worlds):
        by_world[:, k] = E.utility(stats(top, 60_000, seed=500 + k, world=w))
    moyenne = by_world.mean(axis=1)
    minimum = by_world.min(axis=1)
    print("mondes perturbés (utilité moyenne / minimum) :", flush=True)
    for i in np.argsort(-moyenne):
        print(f"  {' → '.join(E.ENGINES_SHORT[x] for x in E.path_of(top[i])):70s} "
              f"moy {moyenne[i]:+.4f} min {minimum[i]:+.4f}", flush=True)

    champ = int(np.argmax(moyenne))
    champion_g = [int(x) for x in top[champ]]
    print("CHAMPION :", " → ".join(E.ENGINES_SHORT[x] for x in E.path_of(top[champ])),
          "genome", champion_g, flush=True)

    rows = []
    for i in np.argsort(-moyenne):
        rows.append({"genome": [int(x) for x in top[i]],
                     "parcours": " → ".join(E.ENGINES_SHORT[x] for x in E.path_of(top[i])),
                     "utilite_moyenne_mondes": round(float(moyenne[i]), 5),
                     "utilite_minimum_mondes": round(float(minimum[i]), 5),
                     "utilite_par_monde": [round(float(x), 5) for x in by_world[i]]})
    E.save(f"halving_{a.tag}.json", {
        "params": vars(a), "modele": a.modele, "etapes": etapes,
        "champion_genome": champion_g, "champion_index_final": champ,
        "final": final, "mondes": rows, "lives_total": int(sum(e["vies_par_strategie"] * e["strategies"]
                                                              for e in etapes) + 300_000 * len(top)
                                                          + 60_000 * len(top) * a.mondes),
        "secondes": time.time() - T0,
    })
    print(f"terminé en {time.time() - T0:.0f} s", flush=True)


if __name__ == "__main__":
    main()
