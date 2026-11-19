"""Analyse « et si » : on change un seul gène de la stratégie gagnante et on mesure l'effet (200 000 vies chacune)."""
import json, sys
import numpy as np
from model import (evaluate, draw_randoms, G_E1, G_E3, G_COF, G_GEO, G_PRICE, G_HOURS, G_FUND, G_SECTOR,
                   G_CHANNEL, G_NICHE, G_KEEP, G_LEARN, G_REINV, M_H12, M_H24, M_H60, M_DUR, M_PUNI, M_QUIT, M_DUR2)
from params import ENG, SEC, WORLD_NOMINAL, SECTORS
from evolve import canonicalize, RES, save

base = np.array(json.loads(sys.argv[1]), dtype=np.int64)
lives = int(sys.argv[2]) if len(sys.argv) > 2 else 200_000
V = [("Stratégie gagnante (référence)", {})]
V += [("Sans la phase closer (agence dès le début)", {G_E1: 2}),
      ("Sans la phase startup (rester une agence)", {G_E3: 2}),
      ("Sans associé", {G_COF: 0}),
      ("Associé seulement au lancement du produit", {G_COF: 1}),
      ("France uniquement", {G_GEO: 0}),
      ("France puis Europe puis USA", {G_GEO: 2}),
      ("Prix bas", {G_PRICE: 0}), ("Prix haut", {G_PRICE: 2}), ("Prix premium", {G_PRICE: 3}),
      ("45 h par semaine", {G_HOURS: 1}), ("65 h par semaine", {G_HOURS: 3}), ("75 h par semaine", {G_HOURS: 4}),
      ("90 h par semaine", {G_HOURS: 5}),
      ("Autofinancé (jamais de VC)", {G_FUND: 0}), ("Accélérateur puis VC", {G_FUND: 1}),
      ("Levée seed classique", {G_FUND: 2}),
      ("Marché large au lieu d'une niche", {G_NICHE: 1}),
      ("Arrêter l'agence en lançant le produit", {G_KEEP: 0}),
      ("Canal : contenu / marque perso", {G_CHANNEL: 1}), ("Canal : publicité", {G_CHANNEL: 2}),
      ("Canal : partenariats", {G_CHANNEL: 3}), ("Canal : réseau / événements", {G_CHANNEL: 5}),
      ("Aucun temps d'apprentissage", {G_LEARN: 0}), ("50 % du temps en apprentissage", {G_LEARN: 3}),
      ("Aucun réinvestissement", {G_REINV: 0}), ("Réinvestir 80 %", {G_REINV: 3})]
for s in range(len(SECTORS)):
    if s != base[G_SECTOR]:
        V.append((f"Secteur : {SECTORS[s]}", {G_SECTOR: s}))
G = []
for _, ch in V:
    g = base.copy()
    for k, v in ch.items():
        g[k] = v
    G.append(g)
G = canonicalize(np.array(G))
rng = np.random.default_rng(2024)
acc = np.zeros((len(G), 7)); done = 0
while done < lives:
    m = min(25_000, lives - done)
    U, Z, UI, ZI = draw_randoms(rng, m)
    o = evaluate(G, U, Z, UI, ZI, ENG, SEC, WORLD_NOMINAL)
    acc += np.stack([o[:, :, k].sum(1) for k in (M_H12, M_H24, M_H60, M_DUR, M_PUNI, M_QUIT, M_DUR2)], 1)
    done += m
acc /= lives
rows = []
for (name, _), a, g in zip(V, acc, G):
    rows.append({"variante": name, "p10k_12m_pct": round(a[0] * 100, 2), "p10k_24m_pct": round(a[1] * 100, 2),
                 "p10k_60m_pct": round(a[2] * 100, 2), "p_durable_60m_pct": round(a[3] * 100, 2),
                 "p_licorne_pct": round(a[4] * 100, 3), "p_abandon_pct": round(a[5] * 100, 1),
                 "part_temps_10k_pct": round(a[6] * 100, 2),
                 "genome": " ".join(str(int(x)) for x in g)})
ref = rows[0]
for r in rows:
    r["delta_24m_pts"] = round(r["p10k_24m_pct"] - ref["p10k_24m_pct"], 2)
    r["delta_durable_pts"] = round(r["p_durable_60m_pct"] - ref["p_durable_60m_pct"], 2)
    r["delta_licorne_pts"] = round(r["p_licorne_pct"] - ref["p_licorne_pct"], 3)
    r["delta_part_pts"] = round(r["part_temps_10k_pct"] - ref["part_temps_10k_pct"], 2)
save("variants.json", {"base": [int(x) for x in base], "lives": lives, "rows": rows})
for r in rows:
    print(f"{r['variante'][:48]:48s} ≤12m {r['p10k_12m_pct']:6.2f} ≤24m {r['p10k_24m_pct']:6.2f} ({r['delta_24m_pts']:+6.2f}) dur {r['p_durable_60m_pct']:6.2f} ({r['delta_durable_pts']:+6.2f}) lic {r['p_licorne_pct']:6.3f} ({r['delta_licorne_pts']:+6.3f}) ab {r['p_abandon_pct']:5.1f}")
