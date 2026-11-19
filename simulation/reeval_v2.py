"""Réévalue, avec la version finale du modèle, toutes les stratégies retenues de la campagne v2."""
import json, os
import numpy as np
from evolve2 import deep_eval, save, RES

def load(n):
    return json.load(open(os.path.join(RES, n), encoding="utf-8"))

m = load("v2_main1.json")
G = np.array([r["strategie"]["genome"] for r in m["final"]])
m["final"] = sorted(deep_eval(G, lives=200_000, seed=4242), key=lambda r: -r["utilite"])
m["lives_deep"] += len(G) * 200_000
m["reevalue_modele_final"] = True
save("v2_main1.json", m)
print("main réévaluée", len(G), flush=True)

L = load("v2_locked.json")
for k, v in L["engines"].items():
    G = np.array([r["strategie"]["genome"] for r in v["final"]])
    v["final"] = sorted(deep_eval(G, lives=60_000, seed=777 + int(k)), key=lambda r: -r["utilite"])
    v["lives"] += len(G) * 60_000
L["lives"] = int(sum(v["lives"] for v in L["engines"].values()))
save("v2_locked.json", L)
print("voies réévaluées", flush=True)

R = load("v2_robust.json")
for i, w in enumerate(R["worlds"]):
    G = np.array([r["strategie"]["genome"] for r in w["top"]])
    w["top"] = sorted(deep_eval(G, lives=30_000, seed=50 + i, world=np.array(w["world"])), key=lambda r: -r["utilite"])
    R["lives"] += len(G) * 30_000
save("v2_robust.json", R)
print("mondes réévalués", flush=True)
