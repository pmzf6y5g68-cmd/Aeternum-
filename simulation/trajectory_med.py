"""Revenu mensuel mois par mois sur 10 ans (quantiles sur N vies), pour une liste de stratégies."""
import json, sys
import numpy as np
from model_med import trace_one, T_MONTHS
from params import ENG, SEC, WORLD_NOMINAL
from evolve2_med import save

specs = json.loads(sys.argv[1])          # [[label, genome], ...]
n = int(sys.argv[2]) if len(sys.argv) > 2 else 5000
rows = []
for label, g in specs:
    inc = np.zeros((n, T_MONTHS))
    for s in range(n):
        _, tr = trace_one(g, seed=500000 + s, W=WORLD_NOMINAL, ENG=ENG, SEC=SEC)
        inc[s] = tr[:, 0]
    for m in range(0, T_MONTHS):
        q = np.quantile(inc[:, m], [0.1, 0.25, 0.5, 0.75, 0.9])
        rows.append({"strategie": label, "mois": m + 1, "p10": round(q[0]), "p25": round(q[1]), "mediane": round(q[2]),
                     "p75": round(q[3]), "p90": round(q[4]), "part_10k_pct": round(float((inc[:, m] >= 10000).mean() * 100), 2)})
    print(label, "médiane m24/m60/m84/m120:", [rows[-T_MONTHS + k]["mediane"] for k in (23, 59, 119, 179)],
          "part≥10k:", [rows[-T_MONTHS + k]["part_10k_pct"] for k in (23, 59, 119, 179)])
save(sys.argv[3] if len(sys.argv) > 3 else "trajectoire.json", {"n": n, "rows": rows})
