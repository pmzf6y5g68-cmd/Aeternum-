"""Analyse « et si » (v2) : on change un seul gène de la stratégie gagnante et on mesure l'effet."""
import json
import sys
import numpy as np
from model import (evaluate_sums, draw_randoms, G_E1, G_E2, G_E3, G_COF, G_GEO, G_PRICE, G_HOURS, G_FUND,
                   G_SECTOR, G_CHANNEL, G_NICHE, G_LEARN, G_REINV, G_BASE, G_HSTART, G_RAMP, M_H12, M_H24, M_H60,
                   M_DUR, M_PUNI, M_QUIT, M_DUR2, M_I24, NM)
from params import ENG, SEC, WORLD_NOMINAL, SECTORS, GENE_LABELS, ENGINES_SHORT
from evolve2 import canon, save, path_of

base = np.array(json.loads(sys.argv[1]), dtype=np.int64)
lives = int(sys.argv[2]) if len(sys.argv) > 2 else 100_000
V = [("Stratégie gagnante (référence)", {})]
for b in range(5):
    if b != base[G_BASE]:
        V.append((f"À côté : {GENE_LABELS['base'][b]}", {G_BASE: b}))
for h in range(4):
    if h != base[G_HSTART]:
        V.append((f"Au début : {GENE_LABELS['hstart'][h]} par semaine", {G_HSTART: h}))
for r in range(6):
    if r != base[G_RAMP]:
        V.append((f"Temps plein : {GENE_LABELS['ramp'][r]}", {G_RAMP: r}))
for h in range(6):
    if h != base[G_HOURS]:
        V.append((f"À temps plein : {GENE_LABELS['hours'][h]} par semaine", {G_HOURS: h}))
for p in range(4):
    if p != base[G_PRICE]:
        V.append((f"Prix {GENE_LABELS['price'][p]}", {G_PRICE: p}))
for c in range(3):
    if c != base[G_COF]:
        V.append((f"Associé : {GENE_LABELS['cof'][c]}", {G_COF: c}))
for g in range(4):
    if g != base[G_GEO]:
        V.append((f"Géographie : {GENE_LABELS['geo'][g]}", {G_GEO: g}))
for f in range(4):
    if f != base[G_FUND]:
        V.append((f"Financement : {GENE_LABELS['fund'][f]}", {G_FUND: f}))
for ch, lab in ((0, "prospection directe"), (1, "contenu / marque perso"), (2, "publicité"), (3, "partenariats"),
                (4, "marketplaces"), (5, "réseau / événements")):
    if ch != base[G_CHANNEL]:
        V.append((f"Canal : {lab}", {G_CHANNEL: ch}))
V.append(("Marché large au lieu d'une niche" if base[G_NICHE] == 0 else "Niche étroite au lieu d'un marché large",
          {G_NICHE: 1 - base[G_NICHE]}))
for s in range(len(SECTORS)):
    if s != base[G_SECTOR]:
        V.append((f"Secteur : {SECTORS[s]}", {G_SECTOR: s}))
# supprimer une phase du parcours
p = path_of(base)
if len(p) >= 2:
    V.append((f"Sans la phase « {ENGINES_SHORT[p[0]]} »", {G_E1: base[G_E2]}))
if len(p) >= 3:
    V.append((f"Sans la phase « {ENGINES_SHORT[p[1]]} »", {G_E2: base[G_E1]}))
G = []
for _, ch in V:
    g = base.copy()
    for k, v in ch.items():
        g[k] = v
    G.append(g)
G = canon(np.array(G))
rng = np.random.default_rng(2024)
acc = np.zeros((len(G), NM))
done = 0
while done < lives:
    m = min(25_000, lives - done)
    U, Z, UI, ZI = draw_randoms(rng, m)
    acc += evaluate_sums(G, U, Z, UI, ZI, ENG, SEC, WORLD_NOMINAL)
    done += m
acc /= lives
rows = []
for (name, _), a, g in zip(V, acc, G):
    rows.append({"variante": name, "p10k_12m_pct": round(a[M_H12] * 100, 2), "p10k_24m_pct": round(a[M_H24] * 100, 2),
                 "p10k_60m_pct": round(a[M_H60] * 100, 2), "p_durable_60m_pct": round(a[M_DUR] * 100, 2),
                 "part_temps_10k_pct": round(a[M_DUR2] * 100, 2), "p_licorne_pct": round(a[M_PUNI] * 100, 3),
                 "p_abandon_pct": round(a[M_QUIT] * 100, 1), "revenu_moyen_24m": round(a[M_I24]),
                 "genome": " ".join(str(int(x)) for x in g)})
ref = rows[0]
for r in rows:
    r["delta_24m_pts"] = round(r["p10k_24m_pct"] - ref["p10k_24m_pct"], 2)
    r["delta_60m_pts"] = round(r["p10k_60m_pct"] - ref["p10k_60m_pct"], 2)
    r["delta_part_pts"] = round(r["part_temps_10k_pct"] - ref["part_temps_10k_pct"], 2)
    r["delta_licorne_pts"] = round(r["p_licorne_pct"] - ref["p_licorne_pct"], 3)
save("v2_variants.json", {"base": [int(x) for x in base], "lives": lives, "rows": rows})
for r in rows:
    print(f"{r['variante'][:55]:55s} ≤24m {r['p10k_24m_pct']:6.2f} ≤60m {r['p10k_60m_pct']:6.2f} ({r['delta_60m_pts']:+6.2f}) "
          f"part {r['part_temps_10k_pct']:6.2f} ({r['delta_part_pts']:+6.2f}) lic {r['p_licorne_pct']:.3f} ab {r['p_abandon_pct']}")
