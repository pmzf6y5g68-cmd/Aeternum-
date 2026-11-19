"""
Croise les sorties finales (calibrage, sélection « on coupe, on relance », variantes, mondes perturbés)
et écrit results/synthese.md : les chiffres cités dans le README et dans la réponse.

Usage : python3 synthese.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, "results")


def load(name):
    p = os.path.join(RES, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None


def pct(x):
    return "—" if x is None else f"{x:.1f} %".replace(".", ",")


def eur(x):
    return "—" if x is None else f"{x:,.0f} €".replace(",", " ")


def fr(x, n=2):
    return f"{x:.{n}f}".replace(".", ",")


out = []
P = out.append

cal = load("calibrage.json")
if cal:
    P("## Calibrage\n")
    P("| Activité | Cible | Avant | Après | Facteur |")
    P("|---|---:|---:|---:|---:|")
    for r in cal["lignes"]:
        P(f"| {r['moteur']} | {pct(r['cible_pct'])} | {pct(r['avant_pct'])} | {pct(r['apres_pct'])} | {fr(r['facteur'], 4)} |")
    P("")

for tag, titre in [("med_10h", "Ta stratégie : au plus 10 h par semaine au début"),
                   ("med_garder", "Meilleure stratégie en gardant médecine (≤ 10 h)"),
                   ("med_libre", "Sans limite d'effort (comparaison)"),
                   ("generic_10h", "Version générique : au plus 10 h par semaine au début")]:
    h = load(f"halving_{tag}.json")
    if not h:
        continue
    P(f"## {titre}\n")
    P("Étapes de coupe et relance :\n")
    P("| Étape | Vies par stratégie | Stratégies | Coupées | Gardées | Relancées | Meilleur score | ≤ 24 mois | ≤ 60 mois | Licorne |")
    P("|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    for e in h["etapes"]:
        P(f"| {e['etape']} | {e['vies_par_strategie']:,} | {e['strategies']} | {e['coupees']} | {e['gardees']} | "
          f"{e['relancees_par_mutation']} | {fr(e['score_meilleure'], 4)} | {pct(e['p10k_24m_meilleure_pct'])} | "
          f"{pct(e['p10k_60m_meilleure_pct'])} | {pct(e['licorne_meilleure_pct'])} |".replace(",", " "))
    P("")
    P("Finalistes (300 000 vies, puis 12 mondes perturbés) :\n")
    P("| Parcours | ≤ 24 mois | ≤ 60 mois | Part du temps ≥ 10 k€ | Licorne | Abandon | Catastrophe | Revenu médian 5 ans | Score (300 000 vies) | Score moyen mondes | Score min mondes |")
    P("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    mondes = {tuple(m["genome"]): m for m in h["mondes"]}
    for r in h["final"]:
        s = r["stats"]
        m = mondes.get(tuple(r["strategie"]["genome"]))
        P(f"| {r['strategie']['parcours']} | {pct(s['p10k_24m'] * 100)} | {pct(s['p10k_60m'] * 100)} | "
          f"{pct(s['part_temps_10k_3_10ans'] * 100)} | {pct(s['p_licorne'] * 100)} | {pct(s['p_abandon'] * 100)} | "
          f"{pct(s['p_catastrophe'] * 100)} | {eur(r['i60_quantiles']['0.5'])} | {fr(r['score'], 4)} | "
          f"{fr(m['score_moyen_mondes'], 4) if m else '—'} | {fr(m['score_min_mondes'], 4) if m else '—'} |")
    P("")
    ch = tuple(h["champion_genome"])
    rec = [r for r in h["final"] if tuple(r["strategie"]["genome"]) == ch]
    if rec:
        P(f"Retenue (score moyen sur les mondes le plus haut) : **{rec[0]['strategie']['parcours']}**\n")
    P("")

v = load("med_variants.json")
if v:
    P("## Et si… : un seul réglage changé (version personnalisée)\n")
    P("| Variante | ≤ 24 mois | ≤ 60 mois | Part du temps ≥ 10 k€ | Licorne | Abandon | Écart ≤ 24 mois (pts) |")
    P("|---|---:|---:|---:|---:|---:|---:|")
    ref = v["rows"][0]
    for r in v["rows"]:
        P(f"| {r['variante']} | {pct(r['p10k_24m_pct'])} | {pct(r['p10k_60m_pct'])} | {pct(r['part_temps_10k_pct'])} | "
          f"{pct(r['p_licorne_pct'])} | {pct(r['p_abandon_pct'])} | {fr(r['delta_24m_pts'], 2)} |")
    P("")

os.makedirs(RES, exist_ok=True)
open(os.path.join(RES, "synthese.md"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("\n".join(out))
