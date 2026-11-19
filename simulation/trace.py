"""Affiche quelques vies simulées mois par mois pour un génome donné."""
import sys, json, numpy as np
from model import trace_one, TRACE_COLS
from params import ENG, SEC, WORLD_NOMINAL, ENGINES_SHORT
g = json.loads(sys.argv[1])
n = int(sys.argv[2]) if len(sys.argv) > 2 else 4
months = [1, 3, 6, 9, 12, 18, 24, 36, 48, 60, 84, 119]
for s in range(n):
    out, tr = trace_one(g, seed=s, W=WORLD_NOMINAL, ENG=ENG, SEC=SEC)
    print(f"--- vie {s}")
    print("mois  " + " ".join(f"{c[:9]:>9s}" for c in TRACE_COLS))
    for m in months:
        row = tr[m]
        cells = []
        for j, v in enumerate(row):
            cells.append(f"{ENGINES_SHORT[int(v)][:9]:>9s}" if j == 1 else f"{v:9.2f}" if abs(v) < 10 else f"{v:9.0f}")
        print(f"{m:4d}  " + " ".join(cells))
