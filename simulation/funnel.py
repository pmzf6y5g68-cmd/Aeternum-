"""Entonnoir VC : quelle part des vies atteint chaque stade de financement (pour calibrer sur les données réelles)."""
import sys, json, numpy as np
from model import trace_one
from params import ENG, SEC, WORLD_NOMINAL
g = json.loads(sys.argv[1]); n = int(sys.argv[2]) if len(sys.argv) > 2 else 3000
mx = np.zeros(n); arr_end = np.zeros(n); dead = np.zeros(n)
for s in range(n):
    out, tr = trace_one(g, seed=10000 + s, W=WORLD_NOMINAL, ENG=ENG, SEC=SEC)
    mx[s] = tr[:, 9].max(); arr_end[s] = tr[-1, 3] * 12; dead[s] = tr[-1, 15]
names = ["accélérateur", "seed", "série A", "série B", "série C", "série D+"]
for k in range(1, 6):
    print(f"atteint {names[k-1]:12s}: {np.mean(mx >= k):.4f}" + (f"   (taux de passage depuis le stade précédent: {np.mean(mx >= k)/max(np.mean(mx >= k-1),1e-9):.2f})" if k > 2 else ""))
print("ARR final si seed: médiane", np.median(arr_end[mx >= 2]) / 1e6, "M€ ; abandon/échec si seed:", dead[mx >= 2].mean())
