"""Vérification de calibration : chaque moteur seul, avec des réglages « raisonnables »."""
import sys
import time
import numpy as np
from model import (evaluate, draw_randoms, NG, G_E1, G_E2, G_E3, G_THR12, G_DL12, G_THR23, G_DL23,
                   G_SECTOR, G_CHANNEL, G_CONTENT, G_PRICE, G_HOURS, G_LEARN, G_REINV, G_FUND,
                   G_RAISE, G_GEO, G_COF, G_NICHE, G_KEEP, M_H12, M_H24, M_H60, M_DUR, M_PUNI,
                   M_SEED, M_PUNI_SEED, M_QUIT, M_CAT, M_I12, M_I24, M_I60, M_LOGW, M_V100M)
from params import ENG, SEC, WORLD_NOMINAL, ENGINES_SHORT


def genome(e1, e2=None, e3=None, **kw):
    g = np.zeros(NG, dtype=np.int64)
    g[G_E1] = e1
    g[G_E2] = e1 if e2 is None else e2
    g[G_E3] = g[G_E2] if e3 is None else e3
    defaults = dict(sector=4, channel=0, content=0, price=1, hours=2, learn=1, reinv=1, fund=0,
                    raise_=0, geo=0, cof=0, niche=0, keep=0, thr12=0, dl12=8, thr23=0, dl23=8)
    defaults.update(kw)
    m = dict(sector=G_SECTOR, channel=G_CHANNEL, content=G_CONTENT, price=G_PRICE, hours=G_HOURS,
             learn=G_LEARN, reinv=G_REINV, fund=G_FUND, raise_=G_RAISE, geo=G_GEO, cof=G_COF,
             niche=G_NICHE, keep=G_KEEP, thr12=G_THR12, dl12=G_DL12, thr23=G_THR23, dl23=G_DL23)
    for k, v in defaults.items():
        g[m[k]] = v
    return g


CASES = [
    ("Salariat", genome(0)),
    ("Freelance", genome(1, channel=4, price=1)),
    ("Agence IA (prix moyen)", genome(2, price=1)),
    ("Agence IA (prix haut)", genome(2, price=2)),
    ("Closer (offres moyennes)", genome(3, price=1)),
    ("Closer (offres hautes)", genome(3, price=2)),
    ("Micro-SaaS", genome(4, channel=1, content=1)),
    ("Startup IA verticale directe, VC", genome(5, fund=2, raise_=1, cof=1, geo=2)),
    ("App IA B2C, VC", genome(6, channel=4, fund=2, raise_=1, geo=3, niche=1)),
    ("Marketplace, VC", genome(7, channel=1, fund=2, raise_=1, cof=1)),
    ("Fintech, accélérateur", genome(8, fund=1, cof=2, geo=1)),
    ("Deeptech, accélérateur", genome(9, fund=1, cof=2, geo=3)),
    ("E-commerce", genome(10, channel=2, reinv=2)),
    ("Contenu", genome(11, niche=0)),
    ("Info-produits", genome(12, channel=1, price=2)),
    ("Trading levier 2", genome(13, price=1)),
    ("Trading levier 10", genome(13, price=3)),
    ("Fraude (témoin)", genome(14)),
    ("Agence → IA verticale (garde l'agence, VC)",
     genome(2, 5, price=2, thr12=4, dl12=5, keep=1, fund=2, raise_=1, cof=1, geo=2)),
    ("Closer → Agence → IA verticale",
     genome(3, 2, 5, price=2, thr12=3, dl12=3, thr23=4, dl23=5, keep=1, fund=2, raise_=1, cof=1, geo=2)),
]

if __name__ == "__main__":
    M = int(sys.argv[1]) if len(sys.argv) > 1 else 20000
    rng = np.random.default_rng(1)
    G = np.stack([c[1] for c in CASES])
    t0 = time.time()
    U, Z, UI, ZI = draw_randoms(rng, M)
    out = evaluate(G, U, Z, UI, ZI, ENG, SEC, WORLD_NOMINAL)
    dt = time.time() - t0
    print(f"{len(CASES)} stratégies × {M} vies en {dt:.1f}s")
    hdr = f"{'stratégie':44s} {'10k≤12m':>8s} {'≤24m':>6s} {'≤60m':>6s} {'durable':>7s} {'licorne':>9s} {'seed':>6s} {'lic|seed':>8s} {'abandon':>7s} {'cata':>5s} {'méd12':>7s} {'méd24':>7s} {'méd60':>7s} {'p90_60':>8s} {'logW':>5s} {'V>100M':>7s}"
    print(hdr)
    for i, (name, _) in enumerate(CASES):
        o = out[i]
        seed = o[:, M_SEED].mean()
        lic_seed = o[:, M_PUNI_SEED].sum() / max(o[:, M_SEED].sum(), 1)
        print(f"{name[:44]:44s} {o[:, M_H12].mean():8.3f} {o[:, M_H24].mean():6.3f} {o[:, M_H60].mean():6.3f} "
              f"{o[:, M_DUR].mean():7.3f} {o[:, M_PUNI].mean():9.5f} {seed:6.3f} {lic_seed:8.4f} "
              f"{o[:, M_QUIT].mean():7.3f} {o[:, M_CAT].mean():5.2f} {np.median(o[:, M_I12]):7.0f} "
              f"{np.median(o[:, M_I24]):7.0f} {np.median(o[:, M_I60]):7.0f} {np.quantile(o[:, M_I60], 0.9):8.0f} "
              f"{o[:, M_LOGW].mean():5.2f} {o[:, M_V100M].mean():7.4f}")
