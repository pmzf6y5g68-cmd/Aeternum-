"""Diagnostic : distribution des valorisations à 10 ans pour les vies qui ont levé un seed."""
import sys, numpy as np
from model import evaluate, draw_randoms, M_SEED, M_VAL, M_PUNI, M_V100M
from params import ENG, SEC, WORLD_NOMINAL
from calibrate import CASES
M = int(sys.argv[1]) if len(sys.argv) > 1 else 20000
names = [c[0] for c in CASES]
idx = [i for i, n in enumerate(names) if 'VC' in n or 'accél' in n or '→' in n]
G = np.stack([CASES[i][1] for i in idx])
U, Z, UI, ZI = draw_randoms(np.random.default_rng(7), M)
out = evaluate(G, U, Z, UI, ZI, ENG, SEC, WORLD_NOMINAL)
for j, i in enumerate(idx):
    o = out[j]; s = o[:, M_SEED] > 0
    v = o[s, M_VAL]
    if s.sum() == 0:
        print(f"{names[i][:44]:44s} aucun seed"); continue
    q = np.quantile(v, [0.5, 0.75, 0.9, 0.97, 0.99])
    print(f"{names[i][:44]:44s} seed={s.mean():.4f} n={s.sum():5d} | valo 10 ans si seed: médiane {q[0]/1e6:7.1f}M p75 {q[1]/1e6:7.1f}M p90 {q[2]/1e6:7.1f}M p97 {q[3]/1e6:7.1f}M p99 {q[4]/1e6:8.1f}M | ≥1Md réel {np.mean(v>=0.925e9):.3f} | p_lic|seed {o[s, M_PUNI].mean():.3f}")
