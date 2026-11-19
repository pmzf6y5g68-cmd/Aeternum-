"""
Transforme les résultats v2 (results/v2_*.json) en jeux de données {rows, meta} pour le tableau de bord.
Chaque fichier embarque le texte de ce script, pour qu'on puisse vérifier comment chaque chiffre est obtenu.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np  # noqa: E402
from model import FAMILY, F_JOB, F_SAL, F_FREE, F_AGENCY, F_CLOSER, F_SVC, F_PROD, F_ECOM, F_FLIP, F_CONTENT, \
    F_INFO, F_AUD, F_TRADING, F_SPEC, F_INV, F_FRAUD  # noqa: E402
from params import WORLD_NAMES, ENGINES_SHORT  # noqa: E402

RES = os.path.join(HERE, "results")
OUT = os.path.join(RES, "dash_v2")
SELF = open(os.path.abspath(__file__), encoding="utf-8").read()
DOMAIN = {F_JOB: "Emploi", F_SAL: "Emploi", F_FREE: "Services", F_AGENCY: "Services", F_CLOSER: "Services",
          F_SVC: "Services", F_PROD: "Startup tech", F_ECOM: "Commerce", F_FLIP: "Commerce", F_CONTENT: "Audience",
          F_INFO: "Audience", F_AUD: "Audience", F_TRADING: "Spéculation", F_SPEC: "Spéculation",
          F_INV: "Placements", F_FRAUD: "Illégal (témoin)"}


def load(name):
    p = os.path.join(RES, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None


def save(name, rows, inputs):
    os.makedirs(OUT, exist_ok=True)
    meta = [{"label": "export_v2.py", "value": SELF, "type": "code", "lang": "python"},
            {"label": "Entrée", "value": ", ".join(inputs)},
            {"label": "Modèle", "value": "simulation/model.py et simulation/evolve2.py (dépôt Aeternum-)"}]
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump({"rows": rows, "meta": meta}, f, ensure_ascii=False)
    print(f"{name}: {len(rows)} lignes, {os.path.getsize(os.path.join(OUT, name)) // 1024} Ko", flush=True)


def r5(x):
    return round(float(x), 5)


def lic_score(p):
    return min(1.0, max(0.0, (np.log10(p + 1e-7) + 5) / 3))


def has_fraud(genome):
    return any(FAMILY[int(x)] == F_FRAUD for x in genome[:3])


def strat_row(r, extra=None):
    s, g = r["stats"], r["strategie"]
    row = {
        "parcours": g["parcours"], "utilite": r5(r["utilite"]),
        "p10k_12m": r5(s["p10k_12m"]), "p10k_24m": r5(s["p10k_24m"]), "p10k_60m": r5(s["p10k_60m"]),
        "p10k_120m": r5(s["p10k_120m"]), "p_durable_60m": r5(s["p_durable_60m"]),
        "part_temps_10k": r5(s["part_temps_10k_3_10ans"]), "p_licorne": r5(s["p_licorne"]),
        "p_levee_seed": r5(s["p_levee_seed"]), "p_abandon": r5(s["p_abandon"]), "p_catastrophe": r5(s["p_catastrophe"]),
        "revenu_median_12m": round(r["i12_quantiles"]["0.5"]), "revenu_median_24m": round(r["i24_quantiles"]["0.5"]),
        "revenu_median_60m": round(r["i60_quantiles"]["0.5"]), "revenu_p90_60m": round(r["i60_quantiles"]["0.9"]),
        "revenu_p90_24m": round(r["i24_quantiles"]["0.9"]),
        "activite_base": g["activité de base"], "heures_debut": g["heures au début"],
        "passage_temps_plein": g["passage à temps plein"], "heures_temps_plein": g["heures à temps plein"],
        "secteur": g["secteur"], "canal": g["canal"], "prix": g["niveau de prix"],
        "apprentissage": g["temps d'apprentissage"], "reinvestissement": g["réinvestissement des bénéfices"],
        "financement": g["financement"], "declencheur_levee": g["déclencheur de levée"], "geographie": g["géographie"],
        "associe": g["associé"], "positionnement": g["positionnement"], "garder_services": g["garder les services"],
        "contenu": g["part de temps en contenu"],
        "passage_1_2": (g.get("passage 1→2") or "sans objet").strip().removeprefix("ou ").strip(),
        "passage_2_3": (g.get("passage 2→3") or "sans objet").strip().removeprefix("ou ").strip(),
        "genome": " ".join(str(x) for x in g["genome"]), "vies_evaluation": r.get("vies", 0),
    }
    for k in [k for k in row if k.startswith("p_") or k.startswith("p10k") or k == "part_temps_10k"]:
        row[k + "_pct"] = round(row[k] * 100, 2)
    if extra:
        row.update(extra)
    return row


def main():
    main1 = load("v2_main1.json")
    locked = load("v2_locked.json")
    robust = load("v2_robust.json")
    variants = load("v2_variants.json")
    traj = load("v2_trajectoire.json")

    # 1. Les trois stratégies à connaître + finalistes distincts
    # la fraude reste dans le modèle comme témoin de contrôle : aucune stratégie qui la contient n'est publiée
    final = [r for r in main1["final"] if not has_fraud(r["strategie"]["genome"])]
    rows_all = [strat_row(r) for r in final]

    def compromise(c):
        return 0.45 * c["p10k_24m"] + 0.30 * lic_score(c["p_licorne"]) * 0.5 + 0.25 * c["part_temps_10k"]
    best = max(rows_all, key=compromise)
    fastest = max(rows_all, key=lambda c: (c["p10k_24m"], c["p10k_12m"], c["part_temps_10k"]))
    steadiest = max(rows_all, key=lambda c: (c["part_temps_10k"], c["p10k_24m"]))
    biggest = max(rows_all, key=lambda c: (c["p_licorne"], c["part_temps_10k"]))
    roles = [("Meilleur compromis", best), ("La plus rapide vers 10 k€", fastest), ("La plus pérenne", steadiest),
             ("Le plus gros potentiel licorne", biggest)]
    champions, used = [], set()
    for role, c in roles:
        c = dict(c)
        c["role"] = role
        c["id"] = role
        c["score_compromis"] = r5(compromise(c))
        champions.append(c)
        used.add(c["genome"])
    seen = {c["parcours"] for c in champions}
    for c in sorted(rows_all, key=lambda c: -compromise(c)):
        if c["parcours"] in seen:
            continue
        seen.add(c["parcours"])
        c = dict(c)
        c["role"] = "Finaliste"
        c["id"] = f"Finaliste {len([x for x in champions if x['role'] == 'Finaliste']) + 1}"
        c["score_compromis"] = r5(compromise(c))
        champions.append(c)
        if len(champions) >= 14:
            break
    save("champions.json", champions, ["results/v2_main1.json"])

    # 2. Convergence
    rows = []
    for e in main1["log"]:
        if e["gen"] % 50 == 0:
            rows.append({"run": "Évolution principale", "generation": e["gen"], "vies_milliards": round(e["vies"] / 1e9, 4),
                         "meilleure_utilite": r5(e["best_util"]), "utilite_moyenne": r5(e["mean_util"]),
                         "meilleur_parcours": e["best"]})
    save("evolution.json", rows, ["results/v2_main1.json"])

    # 3. Espèces : part de la population par parcours
    tot = {}
    for e in main1["log"]:
        for p, c in e["paths"]:
            tot[p] = tot.get(p, 0) + c
    top = [p for p, _ in sorted(tot.items(), key=lambda x: -x[1])[:7]]
    pop = main1["params"]["islands"] * main1["params"]["pop"]
    rows = []
    for e in main1["log"]:
        if e["gen"] % 100:
            continue
        share = {p: c / pop for p, c in e["paths"]}
        autres = 1.0 - sum(share.get(p, 0) for p in top)
        for p in top:
            rows.append({"generation": e["gen"], "parcours": p, "part": r5(share.get(p, 0.0))})
        rows.append({"generation": e["gen"], "parcours": "Autres", "part": r5(max(autres, 0.0))})
    save("especes.json", rows, ["results/v2_main1.json"])

    # 4. Les 50 voies, chacune dans sa meilleure version
    rows, curves = [], []
    for k, v in sorted(locked["engines"].items(), key=lambda kv: int(kv[0])):
        e = int(k)
        if FAMILY[e] == F_FRAUD:
            continue
        r = v["final"][0]
        row = strat_row(r, {"moteur": v["moteur"], "domaine": DOMAIN[int(FAMILY[e])]})
        rows.append(row)
        if v["moteur"] in ("Agence IA", "Closer", "Startup IA verticale", "Info-produits", "Mandataire immobilier",
                           "Trading", "Cours particuliers"):
            curves.append((v["moteur"] + " (meilleure version)", r))
    rows.sort(key=lambda x: -x["utilite"])
    save("moteurs.json", rows, ["results/v2_locked.json"])

    # 5. Course aux 10 k€/mois
    by_genome = {" ".join(str(x) for x in r["strategie"]["genome"]): r for r in final}
    series = [("Meilleur compromis", by_genome[best["genome"]]),
              ("La plus rapide", by_genome[fastest["genome"]])] + curves
    rows = []
    for name, r in series:
        cum = r["p10k_cumul_par_mois"]
        for m in range(0, 120, 3):
            rows.append({"strategie": name, "mois": m + 1, "p_10k_pct": round(cum[m] * 100, 3)})
    save("courbe10k.json", rows, ["results/v2_main1.json", "results/v2_locked.json"])

    # 6. Revenu mois par mois
    if traj:
        save("trajectoire.json", traj["rows"], ["results/v2_trajectoire.json"])

    # 7. Robustesse
    if robust:
        rows = []
        for i, w in enumerate(robust["worlds"]):
            row = strat_row(w["top"][0], {"monde": f"Monde {i + 1}"})
            for name, v in zip(WORLD_NAMES, w["world"]):
                row["x " + name] = round(v, 3)
            rows.append(row)
        save("mondes.json", rows, ["results/v2_robust.json"])

    # 8. Et si…
    if variants:
        save("variantes.json", variants["rows"], ["results/v2_variants.json"])

    # 9. Campagne
    lives = main1["lives"] + main1["lives_deep"] + locked["lives"] + (robust["lives"] if robust else 0)
    gens = main1["generations_total"] + locked["generations"] + (robust["generations"] if robust else 0)
    uniq = main1["unique"] + sum(v.get("unique", 0) for v in locked["engines"].values())
    rows = [{"vies_simulees": int(lives), "generations": int(gens), "strategies_uniques": int(uniq),
             "iles": main1["iles"], "generations_par_ile": main1["generations_par_ile"],
             "mondes_perturbes": len(robust["worlds"]) if robust else 0, "moteurs": len(locked["engines"]),
             "champion": best["parcours"]}]
    save("campagne.json", rows, ["results/v2_main1.json", "results/v2_locked.json", "results/v2_robust.json"])
    # 10. Calibrage : cibles, facteurs et probabilités avant / après
    cal = load("calibrage.json")
    if cal:
        save("calibrage.json", cal["lignes"], ["results/calibrage.json"])
    print("meilleur compromis :", best["parcours"], best["genome"])
    print("plus rapide :", fastest["parcours"], fastest["genome"], fastest["p10k_24m_pct"])
    print("plus pérenne :", steadiest["parcours"], steadiest["genome"], steadiest["part_temps_10k_pct"])


if __name__ == "__main__":
    main()
