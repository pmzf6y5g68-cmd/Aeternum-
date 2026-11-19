"""
Projets à côté de médecine : quel projet rapporte 10 000 € le plus vite, sans jamais quitter médecine ?

Contraintes : médecine maintenue (activité de base 0, jamais de passage à temps plein, donc médecine n'est jamais
arrêtée), au plus 10 h par semaine au départ, aucun moteur spéculatif. Pour chaque projet candidat (un parcours de
moteurs), une petite sélection règle les autres gènes (secteur, prix, canal, déclencheurs…) :
  1) 300 versions tirées au hasard, 4 000 vies chacune ; score = revenu du 12e mois × facteur de valorisation (1 à 2) ;
  2) les 12 meilleures, 40 000 vies chacune ; même score ;
  3) les 3 meilleures sont tracées vie par vie (1 500 vies) pour mesurer le revenu CUMULÉ du projet, et réévaluées
     sur 100 000 vies pour la licorne et l'abandon.
On retient, pour chaque projet, la version qui a le plus de chances d'avoir rapporté 10 000 € au total en 6 mois.
"""
import json
import os
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import model_med as M  # noqa: E402
import evolve2_med as E  # noqa: E402
from params import ENG, SEC, WORLD_NOMINAL, ENGINES_SHORT  # noqa: E402

NUM = {n: i for i, n in enumerate(ENGINES_SHORT)}
PROJETS = [
    ("Cours particuliers", ["Cours particuliers"]),
    ("Cours particuliers → Edtech", ["Cours particuliers", "Edtech"]),
    ("Cours particuliers → Startup IA verticale", ["Cours particuliers", "Startup IA verticale"]),
    ("Info-produits → Edtech", ["Info-produits", "Edtech"]),
    ("Agence IA → Startup IA verticale", ["Agence IA", "Startup IA verticale"]),
    ("Freelance → Micro-SaaS", ["Freelance", "Micro-SaaS"]),
    ("Contenu → Info-produits", ["Contenu", "Info-produits"]),
]
rng = np.random.default_rng(77)


def versions(path, n):
    e = [NUM[x] for x in path]
    while len(e) < 3:
        e.append(e[-1])
    G = np.zeros((n, M.NG), dtype=np.int64)
    for i in range(n):
        g = [int(rng.integers(M.GENE_CARD[k])) for k in range(M.NG)]
        g[M.G_E1], g[M.G_E2], g[M.G_E3] = e
        g[M.G_BASE] = 0      # médecine
        g[M.G_RAMP] = 5      # jamais à temps plein : médecine n'est jamais arrêtée
        g[M.G_HSTART] = int(rng.integers(2))  # 5 ou 10 h par semaine
        G[i] = g
    G = E.canon(G)
    ok = (G[:, M.G_BASE] == 0) & (G[:, M.G_RAMP] == 5) & (G[:, M.G_HSTART] <= 1)
    return G[ok]


def stats(G, n, seed):
    r = np.random.default_rng(seed)
    acc = np.zeros((len(G), M.NM))
    done = 0
    while done < n:
        m = min(20_000, n - done)
        U, Z, UI, ZI = M.draw_randoms(r, m)
        acc += M.evaluate_sums(G, U, Z, UI, ZI, ENG, SEC, WORLD_NOMINAL)
        done += m
    return acc / n


def score(st):
    return st[:, M.M_I12] * (1.0 + np.minimum(1.0, st[:, M.M_PUNI] / 0.005)) * (st[:, M.M_CAT] <= 0.02)


def traces(g, n=1500):
    inc = np.zeros((n, M.T_MONTHS))
    for s in range(n):
        _, tr = M.trace_one([int(x) for x in g], seed=500000 + s, W=WORLD_NOMINAL, ENG=ENG, SEC=SEC)
        inc[s] = tr[:, 0]
    return inc


def main():
    T0 = time.time()
    rows = []
    for nom, path in PROJETS:
        G = versions(path, 300)
        st = stats(G, 4_000, seed=11)
        top = G[np.argsort(-score(st))[:12]]
        st2 = stats(top, 40_000, seed=12)
        top3 = top[np.argsort(-score(st2))[:3]]
        best = None
        for g in top3:
            inc = traces(g)
            cum = np.cumsum(inc[:, :24], axis=1)
            streak = np.zeros(len(inc), dtype=bool)
            for t in range(2, 24):
                streak |= (inc[:, t] >= 10000) & (inc[:, t - 1] >= 10000) & (inc[:, t - 2] >= 10000)
            res = {
                "p_cumul10k_3m": float((cum[:, 2] >= 10000).mean()), "p_cumul10k_6m": float((cum[:, 5] >= 10000).mean()),
                "p_cumul10k_12m": float((cum[:, 11] >= 10000).mean()), "p_cumul10k_24m": float((cum[:, 23] >= 10000).mean()),
                "cumul_median_6m": float(np.median(cum[:, 5])), "cumul_median_12m": float(np.median(cum[:, 11])),
                "revenu_median_6m": float(np.median(inc[:, 5])), "revenu_median_12m": float(np.median(inc[:, 11])),
                "revenu_p90_12m": float(np.quantile(inc[:, 11], 0.9)),
                "p_10k_par_mois_24m": float(streak.mean()), "genome": [int(x) for x in g],
            }
            if best is None or (res["p_cumul10k_6m"], res["p_cumul10k_12m"]) > (best["p_cumul10k_6m"], best["p_cumul10k_12m"]):
                best = res
        rec = E.deep_eval(np.array([best["genome"]], dtype=np.int64), lives=100_000, seed=21)[0]
        s = rec["stats"]
        best.update({"projet": nom, "licorne": s["p_licorne"], "levee_seed": s["p_levee_seed"],
                     "abandon": s["p_abandon"], "strategie": rec["strategie"]})
        rows.append(best)
        print(f"{nom:42s} cumul 10 k€ : 3 mois {best['p_cumul10k_3m']*100:5.1f} % | 6 mois {best['p_cumul10k_6m']*100:5.1f} % | "
              f"12 mois {best['p_cumul10k_12m']*100:5.1f} % | médiane cumul 12 mois {best['cumul_median_12m']:7.0f} € | "
              f"10 k€/mois en 2 ans {best['p_10k_par_mois_24m']*100:4.1f} % | licorne {best['licorne']*100:.3f} % | "
              f"abandon {best['abandon']*100:4.1f} %", flush=True)
    E.save("projets_cote.json", {"projets": rows, "secondes": time.time() - T0,
                                 "contraintes": "médecine jamais arrêtée, au plus 10 h par semaine, sans spéculation"})
    print(f"terminé en {time.time() - T0:.0f} s")


if __name__ == "__main__":
    main()
