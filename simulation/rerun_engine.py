"""Relance l'évolution d'une seule voie (après correction du modèle) et remplace son entrée dans results/locked.json."""
import json, sys, time
import numpy as np
from evolve import run_ga, archive_top, utility, deep_eval, save, RES
from model import M_S, M_PUNI
from params import ENGINES_SHORT

e = int(sys.argv[1])
t0 = time.time()
P, st, rank, cache, log = run_ga(200, 300, 192, 7 + e, lock=e, label=ENGINES_SHORT[e], log_every=5)
Ga, sta = archive_top(cache, 192)
ut = utility(sta)
best = [int(i) for i in np.argsort(-ut)[:3]]
G = Ga[sorted(set(best + [int(np.argmax(sta[:, M_S])), int(np.argmax(sta[:, M_PUNI]))]))]
deep = deep_eval(G, lives=50_000)
deep.sort(key=lambda r: -r["utilite"])
d = json.load(open(f"{RES}/locked.json"))
for i, x in enumerate(d["engines"]):
    if x["moteur"] == ENGINES_SHORT[e]:
        d["lives"] += int(cache.lives) - x["lives"]
        d["engines"][i] = {"moteur": ENGINES_SHORT[e], "lives": int(cache.lives), "final": deep, "log": log[::4]}
save("locked.json", d)
s = deep[0]["stats"]
print(f"{ENGINES_SHORT[e]} relancé en {time.time()-t0:.0f}s : 10k≤12m {s['p10k_12m']:.4f} catastrophe {s['p_catastrophe']:.3f}")
