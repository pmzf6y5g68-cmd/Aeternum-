"""
Calibrage du modèle sur les données réelles.

Pour chaque activité dont le modèle surestimait la réussite, on cherche le facteur de difficulté du
marché (colonne P_CAL de ENG) tel que la MEILLEURE version de l'activité, pratiquée seule par un
jeune de 18 ans sans expérience, atteigne 10 k€/mois (3 mois de suite) en 10 ans avec la
probabilité cible ci-dessous.

Les cibles sont des ordres de grandeur. Certaines s'appuient sur les données publiques suivantes ; la
plupart sont des jugements, signalés comme tels dans le bloc TARGETS et dans le README :
- créateurs de contenu : 4 à 5 % des créateurs actifs dépassent 100 000 $/an (Aspire 2022 : 4,3 % ;
  Kajabi 2024 : 4 %), 9 % chez les créateurs indépendants à plein temps (MBO Partners) ; 1 à 5 % des
  vendeurs de formations en ligne dépassent 100 000 $/an ;
- Insee : un non-salarié « classique » de l'information-communication gagne en moyenne environ 4 130 €/mois
  (lecture du tableau à confirmer ; le neuvième décile n'a pas été vérifié) ; 22 % des micro-entrepreneurs de
  moins de 30 ans sont encore actifs 3 ans après leur immatriculation ; 63 % des entreprises individuelles classiques et
  39 % des micro-entreprises qui ont démarré survivent 5 ans ;
- Chague, De-Losso et Giovannetti (« Day Trading for a Living? ») : 1,1 % des day traders brésiliens suivis
  gagnent plus que le salaire minimum (le chiffre de 97 % de pertes n'a pas été vérifié) ;
- les startups ne sont corrigées que pour le revenu du fondateur (les taux de levée et de licorne
  restent calés sur CB Insights et Carta).

Le calibrage se fait en deux passes : 1) sur les meilleures versions trouvées avant calibrage ;
2) on relance l'évolution de chaque activité avec les nouveaux facteurs (le meilleur réglage peut
changer), puis on recale sur l'ensemble des candidates. Les facteurs sont écrits dans params.py.
"""
import json
import os
import re
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np  # noqa: E402
import params  # noqa: E402
from params import SEC, WORLD_NOMINAL, ENGINES_SHORT  # noqa: E402
from model import evaluate_sums, draw_randoms, M_H120, M_S, M_PUNI, M_DUR2, P_CAL  # noqa: E402
from evolve2 import run_islands, hof_arrays, utility, save  # noqa: E402

ENG = params.ENG  # modifié sur place : evolve2 et model voient les mêmes facteurs

# probabilité cible d'atteindre 10 k€/mois (3 mois de suite) en 10 ans, meilleure version, activité seule
TARGETS = {
    1: 0.10,    # freelance : jugement (aucune source directe)
    2: 0.06,    # agence IA : jugement, borné par la survie à 5 ans (Insee : 63 % des entreprises individuelles, 39 % des micro-entreprises qui ont démarré)
    3: 0.04,    # closer : jugement (commission seule, forte rotation)
    4: 0.03,    # micro-SaaS : jugement
    5: 0.05,    # startup IA verticale : jugement (levées et licornes calées par ailleurs)
    10: 0.02,   # e-commerce : jugement
    11: 0.03,   # contenu : 4 à 5 % des créateurs gagnent plus de 100 000 $/an (Aspire 2022, Kajabi 2024)
    12: 0.05,   # info-produits : estimation (1 à 5 % des vendeurs de formations, chiffres de plateformes non vérifiés)
    13: 0.01,   # trading : Chague et al. (1,1 % des day traders suivis gagnent plus que le salaire minimum)
    15: 0.04,   # agence réseaux sociaux : jugement
    19: 0.04,   # conciergerie Airbnb : jugement
    24: 0.05,   # mandataire immobilier : jugement (commission seule, forte rotation)
    25: 0.06,   # artisan du bâtiment : jugement
    35: 0.04,   # marque e-commerce : jugement
    38: 0.005,  # streaming : jugement (très peu de streamers vivent de leur activité)
    39: 0.02,   # sites SEO / affiliation : jugement
    40: 0.02,   # newsletter payante : jugement
    41: 0.01,   # musique : jugement
    42: 0.005,  # paris sportifs : jugement (comptes limités par les opérateurs)
    43: 0.01,   # poker en ligne : jugement
    44: 0.01,   # memecoins / NFT : jugement
}
LIVES = 40_000
CHUNK = 20_000


def p10y(G, lives=LIVES, seed=11):
    """Probabilité d'atteindre 10 k€/mois en 10 ans pour chaque génome (nombres aléatoires communs)."""
    rng = np.random.default_rng(seed)
    acc = np.zeros(len(G))
    done = 0
    while done < lives:
        m = min(CHUNK, lives - done)
        U, Z, UI, ZI = draw_randoms(rng, m)
        acc += evaluate_sums(G, U, Z, UI, ZI, ENG, SEC, WORLD_NOMINAL)[:, M_H120]
        done += m
    return acc / lives


def fit(cands, iters=13):
    """Bissection géométrique simultanée sur toutes les activités ; renvoie {moteur: facteur}."""
    owners = sorted(cands)
    G = np.concatenate([np.array(cands[e], dtype=np.int64) for e in owners])
    idx = {}
    k0 = 0
    for e in owners:
        idx[e] = list(range(k0, k0 + len(cands[e])))
        k0 += len(cands[e])
    for e in owners:
        ENG[e, P_CAL] = 1.0
    p = p10y(G)
    best1 = {e: float(max(p[i] for i in idx[e])) for e in owners}
    lo = {e: 0.0005 for e in owners}
    hi = {e: 1.0 for e in owners}
    todo = [e for e in owners if best1[e] > TARGETS[e]]
    for it in range(iters):
        for e in todo:
            ENG[e, P_CAL] = (lo[e] * hi[e]) ** 0.5
        p = p10y(G)
        for e in todo:
            pe = max(p[i] for i in idx[e])
            if pe > TARGETS[e]:
                hi[e] = ENG[e, P_CAL]
            else:
                lo[e] = ENG[e, P_CAL]
    k = {e: 1.0 for e in owners}
    for e in todo:
        k[e] = round(float((lo[e] * hi[e]) ** 0.5), 4)
        ENG[e, P_CAL] = k[e]
    p = p10y(G, seed=12)
    after = {e: float(max(p[i] for i in idx[e])) for e in owners}
    return k, best1, after


def relock(engines, gens, seed):
    """Relance l'évolution de chaque activité seule avec les facteurs courants ; renvoie ses meilleures."""
    out = {}
    for e in engines:
        isl, _ = run_islands(2, 64, 16, 512, seed + e, lock=e, gens=gens, label=ENGINES_SHORT[e],
                             verbose=False, log_every=1000)
        G, st, n = hof_arrays(isl)
        if len(G) == 0:
            keys = [isl.key(g) for g in isl.P]
            G, st = isl.P, isl.means(keys)
        ut = utility(st)
        sel = set(int(i) for i in np.argsort(-ut)[:4])
        sel |= {int(np.argmax(st[:, M_S])), int(np.argmax(st[:, M_PUNI])), int(np.argmax(st[:, M_DUR2]))}
        sel |= set(int(i) for i in np.argsort(-st[:, M_S])[:3])
        out[e] = [[int(x) for x in G[i]] for i in sorted(sel)]
        print(f"  {ENGINES_SHORT[e]:24s} {len(out[e])} candidates", flush=True)
    return out


def main():
    T0 = time.time()
    locked = json.load(open(os.path.join(HERE, "results", "v2_locked.json"), encoding="utf-8"))
    cands = {e: [r["strategie"]["genome"] for r in locked["engines"][str(e)]["final"]] for e in TARGETS}
    print("passe 1 : meilleures versions d'avant calibrage", flush=True)
    k1, before, after1 = fit(cands)
    for e in sorted(TARGETS):
        print(f"  {ENGINES_SHORT[e]:24s} avant {before[e] * 100:6.2f} %  cible {TARGETS[e] * 100:5.2f} %  "
              f"facteur {k1[e]:.4f}  après {after1[e] * 100:6.2f} %", flush=True)
    print(f"({time.time() - T0:.0f} s) passe 2 : nouvelle évolution de chaque activité avec les facteurs", flush=True)
    new = relock(sorted(TARGETS), gens=int(sys.argv[1]) if len(sys.argv) > 1 else 200, seed=4242)
    for e in TARGETS:
        cands[e] = cands[e] + new[e]
    k2, b2, after2 = fit(cands)
    rows = []
    for e in sorted(TARGETS):
        rows.append({"moteur": ENGINES_SHORT[e], "indice": e, "cible_pct": TARGETS[e] * 100,
                     "avant_pct": round(before[e] * 100, 2), "facteur": k2[e],
                     "apres_pct": round(after2[e] * 100, 2), "candidates": len(cands[e])})
        print(f"  {ENGINES_SHORT[e]:24s} avant {before[e] * 100:6.2f} %  cible {TARGETS[e] * 100:5.2f} %  "
              f"facteur {k2[e]:.4f}  après {after2[e] * 100:6.2f} %", flush=True)
    save("calibrage.json", {"cibles": {str(e): TARGETS[e] for e in TARGETS}, "lignes": rows,
                            "secondes": time.time() - T0})
    # écrit les facteurs dans params.py
    path = os.path.join(HERE, "params.py")
    s = open(path, encoding="utf-8").read()
    lit = "CALIBRAGE = {" + ", ".join(f"{e}: {k2[e]}" for e in sorted(TARGETS) if k2[e] < 1.0) + "}"
    s, n = re.subn(r"^CALIBRAGE = \{.*\}$", lit, s, flags=re.M)
    assert n == 1
    open(path, "w", encoding="utf-8").write(s)
    print(lit)
    print(f"terminé en {time.time() - T0:.0f} s")


if __name__ == "__main__":
    main()
