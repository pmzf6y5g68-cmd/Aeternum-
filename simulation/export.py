"""
Transforme les résultats (results/*.json) en jeux de données {rows, meta} pour le tableau de bord.

Toutes les stratégies affichées sont réévaluées ici avec la version finale du modèle (mêmes métriques partout).
Chaque fichier embarque le texte de ce script, pour qu'on puisse vérifier comment chaque chiffre est obtenu.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np  # noqa: E402
from evolve import deep_eval  # noqa: E402
from params import WORLD_NAMES  # noqa: E402

RES = os.path.join(HERE, "results")
OUT = os.path.join(RES, "dash")
SELF = open(os.path.abspath(__file__), encoding="utf-8").read()
RUNS = [("Évolution 1", "main_seed1.json"), ("Évolution 2", "main_seed2.json"),
        ("Évolution 3 (pérennité stricte)", "main_seed3_dur2.json")]


def load(name):
    p = os.path.join(RES, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None


def save(name, rows, inputs):
    os.makedirs(OUT, exist_ok=True)
    meta = [{"label": "export.py", "value": SELF, "type": "code", "lang": "python"},
            {"label": "Entrée", "value": ", ".join(inputs)},
            {"label": "Modèle", "value": "simulation/model.py et simulation/evolve.py (dépôt Aeternum-)"}]
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump({"rows": rows, "meta": meta}, f, ensure_ascii=False)
    print(f"{name}: {len(rows)} lignes, {os.path.getsize(os.path.join(OUT, name)) // 1024} Ko", flush=True)


def r5(x):
    return round(float(x), 5)


def reglages(moteur, g):
    """Les réglages qui comptent vraiment pour cette voie, en clair."""
    prix = g["niveau de prix"]
    h = g["heures/semaine"] + "/sem."
    if moteur == "Trading":
        lev = {"bas": "×1", "moyen": "×2", "haut": "×5", "premium": "×10"}[prix]
        return f"levier {lev} · {h}"
    if moteur == "Closer":
        return f"offres de prix {prix} · {h}"
    if moteur == "Info-produits":
        return f"{g['positionnement']} · prix {prix} · {h}"
    if moteur == "Contenu":
        return f"{g['positionnement']} · {h}"
    if moteur in ("Salariat", "Fraude"):
        return h
    if moteur == "Freelance":
        return f"prix {prix} · {g['canal'].split(' (')[0].lower()} · {g['géographie'].lower()} · {h}"
    if moteur == "E-commerce":
        return f"prix {prix} · réinvestit {g['réinvestissement des bénéfices']} · {h}"
    base = f"{g['secteur']} · prix {prix} · {g['canal'].split(' (')[0].lower()} · {h}"
    if moteur == "Agence IA":
        return base + f" · associé {g['associé']} · {g['géographie'].lower()}"
    return base + f" · {g['financement'].lower()} · associé {g['associé']} · {g['géographie'].lower()}"


def strat_row(r, extra=None):
    s, g = r["stats"], r["strategie"]
    row = {
        "parcours": g["parcours"], "utilite": r5(r["utilite"]),
        "p10k_6m": r5(s["p10k_6m"]), "p10k_12m": r5(s["p10k_12m"]), "p10k_24m": r5(s["p10k_24m"]),
        "p10k_60m": r5(s["p10k_60m"]), "p_durable_60m": r5(s["p_durable_60m"]),
        "part_temps_10k": r5(s["part_temps_10k_3_10ans"]), "p_licorne": r5(s["p_licorne"]),
        "p_levee_seed": r5(s["p_levee_seed"]), "p_abandon": r5(s["p_abandon"]), "p_catastrophe": r5(s["p_catastrophe"]),
        "revenu_median_12m": round(r["i12_quantiles"]["0.5"]), "revenu_median_24m": round(r["i24_quantiles"]["0.5"]),
        "revenu_median_60m": round(r["i60_quantiles"]["0.5"]), "revenu_p90_60m": round(r["i60_quantiles"]["0.9"]),
        "revenu_p10_60m": round(r["i60_quantiles"]["0.1"]),
        "secteur": g["secteur"], "canal": g["canal"], "prix": g["niveau de prix"], "heures": g["heures/semaine"],
        "apprentissage": g["temps d'apprentissage"], "reinvestissement": g["réinvestissement des bénéfices"],
        "financement": g["financement"], "declencheur_levee": g["déclencheur de levée"], "geographie": g["géographie"],
        "associe": g["associé"], "positionnement": g["positionnement"], "garder_agence": g["garder l'agence"],
        "contenu": g["part de temps en contenu"],
        "passage_1_2": (g.get("passage 1→2") or "sans objet").strip().removeprefix("ou ").strip(),
        "passage_2_3": (g.get("passage 2→3") or "sans objet").strip().removeprefix("ou ").strip(),
        "genome": " ".join(str(x) for x in g["genome"]),
    }
    for k in [k for k in row if k.startswith("p_") or k.startswith("p10k") or k == "part_temps_10k"]:
        row[k + "_pct"] = round(row[k] * 100, 2)
    if extra:
        row.update(extra)
    return row


def distinct_top(final, k):
    out, seen = [], set()
    for r in sorted(final, key=lambda r: -r["utilite"]):
        p = r["strategie"]["parcours"]
        if p not in seen:
            seen.add(p)
            out.append(r)
        if len(out) >= k:
            break
    return out


def main():
    runs = [(lab, fn, load(fn)) for lab, fn in RUNS]
    runs = [(lab, fn, d) for lab, fn, d in runs if d]
    locked = load("locked.json")
    robust = load("robust.json")
    variants = load("variants.json")
    traj = load("trajectoire.json")
    inputs = [f"results/{fn}" for _, fn, _ in runs]

    # 1. Finalistes de chaque évolution, réévalués sur 200 000 vies avec le modèle final
    picks = []
    for lab, fn, d in runs:
        for i, r in enumerate(distinct_top(d["final"], 3)):
            picks.append((lab, i + 1, np.array(r["strategie"]["genome"])))
    deep = deep_eval(np.array([p[2] for p in picks]), lives=200_000, seed=4242)
    champions = []
    for (lab, rank, _), r in zip(picks, deep):
        champions.append(strat_row(r, {"run": lab, "rang": rank, "id": f"{lab.split(' (')[0]} · n°{rank}"}))
    # Stratégie gagnante retenue : parmi les n°1 des évolutions, le meilleur compromis
    # (10 k€ en 24 mois, part du temps ≥ 10 k€ entre 3 et 10 ans, potentiel licorne en échelle log)
    firsts = [c for c in champions if c["rang"] == 1]

    def score(c):
        lic = min(1.0, max(0.0, (np.log10(c["p_licorne"] + 1e-7) + 5) / 3))
        return 0.45 * c["p10k_24m"] + 0.30 * lic + 0.25 * c["part_temps_10k"]
    best = max(firsts, key=score)
    for c in champions:
        c["score_compromis"] = r5(score(c))
    champions.sort(key=lambda c: (c is not best, -c["score_compromis"]))
    save("champions.json", champions, inputs)
    champ_genome = [int(x) for x in best["genome"].split()]

    # 2. Évolution génération par génération
    rows = []
    for lab, fn, d in runs:
        last = len(d["log"]) - 1
        for e in d["log"]:
            if e["gen"] % 5 == 0 or e["gen"] == last:
                rows.append({"run": lab, "generation": e["gen"], "vies_millions": round(e["vies"] / 1e6, 2),
                             "strategies_uniques": e["strategies_uniques"], "meilleure_utilite": r5(e["best_util"]),
                             "utilite_moyenne": r5(e["mean_util"]), "meilleur_parcours": e["best"]})
    save("evolution.json", rows, inputs)

    # 3. Espèces : part de la population par parcours (évolution 1)
    lab, fn, d = runs[0]
    tot = {}
    for e in d["log"]:
        for p, c in e["paths"]:
            tot[p] = tot.get(p, 0) + c
    top = [p for p, _ in sorted(tot.items(), key=lambda x: -x[1])[:7]]
    pop = d["params"]["pop"]
    rows = []
    for e in d["log"]:
        if e["gen"] % 10 and e["gen"] != len(d["log"]) - 1:
            continue
        share = {p: c / pop for p, c in e["paths"]}
        autres = 1.0 - sum(share.get(p, 0) for p in top)
        for p in top:
            rows.append({"generation": e["gen"], "parcours": p, "part": r5(share.get(p, 0.0))})
        rows.append({"generation": e["gen"], "parcours": "Autres", "part": r5(max(autres, 0.0))})
    save("especes.json", rows, inputs[:1])

    # 4. Meilleure version de chaque voie (réévaluée)
    rows, curves = [], []
    if locked:
        G = np.array([e["final"][0]["strategie"]["genome"] for e in locked["engines"]])
        deep = deep_eval(G, lives=100_000, seed=777)
        for e, r in zip(locked["engines"], deep):
            rows.append(strat_row(r, {"moteur": e["moteur"], "reglages": reglages(e["moteur"], r["strategie"])}))
            if e["moteur"] in ("Agence IA", "Closer", "Freelance", "Startup IA verticale", "Contenu", "Trading"):
                curves.append((e["moteur"] + " (meilleure version)", r))
        rows.sort(key=lambda x: -x["utilite"])
        save("moteurs.json", rows, ["results/locked.json"])

    # 5. Course aux 10 k€/mois
    champ_deep = deep_eval(np.array([champ_genome]), lives=200_000, seed=4242)[0]
    series = [("Stratégie gagnante", champ_deep)] + curves
    rows = []
    for name, r in series:
        cum = r["p10k_cumul_par_mois"]
        for m in range(0, 120, 3):
            rows.append({"strategie": name, "mois": m + 1, "p_10k_pct": round(cum[m] * 100, 2)})
    save("courbe10k.json", rows, inputs + ["results/locked.json"])

    # 6. Revenu de la stratégie gagnante, mois par mois (quantiles sur des vies tracées)
    if traj:
        first = traj["rows"][0]["strategie"]
        save("trajectoire.json", [r for r in traj["rows"] if r["strategie"] == first], ["results/trajectoire.json"])

    # 7. Robustesse : le gagnant de chaque monde perturbé, réévalué dans son monde
    if robust:
        rows = []
        for i, w in enumerate(robust["worlds"]):
            g = np.array([w["top"][0]["strategie"]["genome"]])
            r = deep_eval(g, lives=40_000, seed=99 + i, world=np.array(w["world"]))[0]
            row = strat_row(r, {"monde": f"Monde {i + 1}"})
            for name, v in zip(WORLD_NAMES, w["world"]):
                row["x " + name] = round(v, 3)
            rows.append(row)
        save("mondes.json", rows, ["results/robust.json"])

    # 8. Et si… : un gène de la stratégie gagnante à la fois
    if variants:
        save("variantes.json", variants["rows"], ["results/variants.json"])

    # 9. Résumé chiffré de la campagne
    lives = sum(d["lives"] for _, _, d in runs) + (locked["lives"] if locked else 0) + (robust["lives"] if robust else 0)
    gens = sum(len(d["log"]) for _, _, d in runs) + (15 * locked["params"]["gens"] if locked else 0) \
        + (len(robust["worlds"]) * robust["params"]["gens"] if robust else 0)
    rows = [{"vies_simulees": int(lives), "generations": int(gens),
             "strategies_uniques": int(sum(d["unique"] for _, _, d in runs)),
             "mondes_perturbes": len(robust["worlds"]) if robust else 0, "evolutions_principales": len(runs),
             "champion": best["parcours"], "champion_run": best["run"]}]
    save("campagne.json", rows, inputs + ["results/locked.json", "results/robust.json"])
    print("champion :", best["parcours"], "|", best["run"], "|", champ_genome)


if __name__ == "__main__":
    main()
