"""
Jeux de données de la version personnalisée (étudiant·e en médecine de 18 ans près de Paris, horizon 15 ans).

Rôles comparés :
- « Ta stratégie retenue » : la stratégie gagnante de la sélection « on coupe, on relance » (halving.py),
  avec au plus 10 h par semaine au début ;
- « Sans limite d'effort » : la même sélection, sans borne sur les heures de départ ;
- « Ta stratégie en gardant médecine » : la stratégie retenue, en maintenant médecine (le projet se fait à côté) ;
- « Référence : médecine seule » : aucun projet, l'épargne placée en bourse.

Chaque stratégie est réévaluée sur 300 000 vies ; la trajectoire est tracée sur 2 000 vies.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np  # noqa: E402
import model_med as mm  # noqa: E402
from params import ENG, SEC, WORLD_NOMINAL  # noqa: E402
from evolve2_med import deep_eval, canon  # noqa: E402
from export_v2 import strat_row, OUT  # noqa: E402

SELF = open(os.path.abspath(__file__), encoding="utf-8").read()
RES = os.path.join(HERE, "results")
N_TRACE = 2000


def load(name):
    return json.load(open(os.path.join(RES, name), encoding="utf-8"))


def save(name, rows, inputs):
    os.makedirs(OUT, exist_ok=True)
    meta = [{"label": "export_med.py", "value": SELF, "type": "code", "lang": "python"},
            {"label": "Entrée", "value": ", ".join(inputs)},
            {"label": "Modèle", "value": "simulation/model_med.py et simulation/evolve2_med.py (dépôt Aeternum-)"}]
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump({"rows": rows, "meta": meta}, f, ensure_ascii=False)
    print(f"{name}: {len(rows)} lignes", flush=True)


def key(g):
    return tuple(int(x) for x in g)


def traces(genome):
    """Revenu mensuel de N_TRACE vies et premier mois à temps plein (drapeau « temps plein » de la trace)."""
    g = [int(x) for x in genome]
    inc = np.zeros((N_TRACE, mm.T_MONTHS))
    ramp = np.full(N_TRACE, -1)
    for s in range(N_TRACE):
        _, tr = mm.trace_one(g, seed=700000 + s, W=WORLD_NOMINAL, ENG=ENG, SEC=SEC)
        inc[s] = tr[:, 0]
        idx = np.where(tr[:, 12] > 0.5)[0]
        if len(idx):
            ramp[s] = idx[0] + 1
    return inc, ramp


def main():
    h10 = load("halving_med_10h.json")
    hl = load("halving_med_libre.json")
    g10 = canon(np.array([h10["champion_genome"]], dtype=np.int64))[0]
    gl = canon(np.array([hl["champion_genome"]], dtype=np.int64))[0]
    keep = np.array(g10, copy=True)
    keep[mm.G_BASE] = 0  # médecine maintenue : arrêt seulement si le projet décolle
    keep = canon(keep[None])[0]
    # référence : médecine seule (l'épargne placée en bourse, aucun projet)
    ref = np.zeros(mm.NG, dtype=np.int64)
    ref[[mm.G_E1, mm.G_E2, mm.G_E3]] = 48
    ref[mm.G_DL12] = 8
    ref[mm.G_DL23] = 8
    ref[mm.G_BASE] = 0
    ref[mm.G_HSTART] = 0
    ref[mm.G_RAMP] = 5
    ref = canon(ref[None])[0]

    roles = [("Ta stratégie retenue (≤ 10 h par semaine au début)", g10)]
    seen = {key(g10)}
    for name, g in [("Sans limite d'effort", gl), ("Ta stratégie en gardant médecine", keep),
                    ("Référence : médecine seule", ref)]:
        if key(g) in seen:
            print(f"  « {name} » identique à une ligne précédente : non répétée", flush=True)
            continue
        seen.add(key(g))
        roles.append((name, g))

    rows, traj = [], []
    for role, g in roles:
        rec = deep_eval(np.array([g], dtype=np.int64), lives=300_000, seed=4321)[0]
        inc, ramp = traces(g)
        plein = ramp[ramp > 0]
        row = strat_row(rec, {"role": role, "id": role,
                              "mois_temps_plein_median": float(np.median(plein)) if len(plein) else None,
                              "part_temps_plein_36m_pct": round(float(((ramp > 0) & (ramp <= 36)).mean() * 100), 2)})
        rows.append(row)
        for m in range(mm.T_MONTHS):
            q = np.quantile(inc[:, m], [0.25, 0.5, 0.75])
            traj.append({"strategie": role, "mois": m + 1, "age": round(18 + (m + 1) / 12.0, 2),
                         "p25": round(q[0]), "mediane": round(q[1]), "p75": round(q[2]),
                         "part_10k_pct": round(float((inc[:, m] >= 10000).mean() * 100), 2)})
        print(f"{role}: ≤24m {row['p10k_24m_pct']} % ≤60m {row['p10k_60m_pct']} % "
              f"part {row['part_temps_10k_pct']} % licorne {row['p_licorne_pct']} % "
              f"abandon {row['p_abandon_pct']} % | médiane 24m {row['revenu_median_24m']} "
              f"60m {row['revenu_median_60m']}", flush=True)

    save("champions_med.json", rows, ["results/halving_med_10h.json", "results/halving_med_libre.json"])
    save("trajectoire_med.json", traj, ["results/med_main1.json", "re-tracé sur 2 000 vies"])

    if os.path.exists(os.path.join(RES, "med_variants.json")):
        v = load("med_variants.json")
        save("variantes_med.json", v["rows"], ["results/med_variants.json"])


if __name__ == "__main__":
    main()
