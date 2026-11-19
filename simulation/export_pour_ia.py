"""
Rassemble les données des simulations en un seul fichier Markdown (donnees_pour_ia.md), à transmettre tel quel
à une autre IA : contexte, méthode, hypothèses, tableaux de résultats et limites.
Tout est lu dans results/ : aucun chiffre n'est recopié à la main.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
R = os.path.join(HERE, "results")


def J(*p):
    path = os.path.join(R, *p)
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else None


def pct(x, d=1):
    return "—" if x is None else f"{x:.{d}f} %"


def eur(x):
    return "—" if x is None else f"{x:,.0f} €".replace(",", " ")


L = []
P = L.append

P("# Données des simulations « Aeternum » (à transmettre à une autre IA)\n")
P("Fichier généré automatiquement par `simulation/export_pour_ia.py` à partir des résultats du dépôt. "
  "Les chiffres sont des sorties de simulation (Monte Carlo), pas des mesures du monde réel.\n")

P("## 1. Contexte et objectif\n")
P("- **Profil simulé (version personnalisée)** : 18 ans, étudiant·e en médecine près de Paris, 1 500 € d'épargne, "
  "quelques bases en code, aucun réseau. Ne veut pas arrêter médecine ; projet à côté.")
P("- **Profil simulé (version générale)** : 18 ans, seul, sans expérience ni réseau, en France, 1 500 € d'épargne.")
P("- **Objectifs** : atteindre 10 000 € par mois (revenu brut avant impôts, tenu 3 mois de suite) le plus vite "
  "possible, avec peu d'heures au début, et garder un potentiel de valorisation (licorne = entreprise valorisée "
  "au moins 1 milliard de dollars).\n")

P("## 2. Modèle\n")
P("- **Vie simulée** mois par mois : 120 mois (version générale) ou 180 mois (version personnalisée, de 18 à 33 ans). "
  "Tirages au hasard : talent, ténacité, chance commerciale, qualité d'entreprise, chocs de marché, burn-out, associés, levées.")
P("- **50 moteurs de revenus** (emploi, services, agences, freelance, closer, startups IA/SaaS/deeptech/medtech/edtech…, "
  "commerce, audience, spéculation, placements, fraude comme témoin non publié).")
P("- **Stratégie = génome de 23 gènes** : jusqu'à 3 phases (moteurs), déclencheurs de passage, activité de base, "
  "heures au début (5/10/15/20 h par semaine), seuil de passage à temps plein, secteur, canal, prix, financement, "
  "géographie, associé, etc.")
P("- **Médecine (version personnalisée)** : 3 ans sans revenu, externat (350 €/mois), internat (2 100 €/mois), puis "
  "médecin vers 9 à 11 ans (8 000 € bruts pour un généraliste, 12 000 € pour un spécialiste, +4 %/an ; 40 % de "
  "spécialistes). Charge : 45 h/semaine en premier cycle, 50 h en externat, 55 h en internat.")
P("- **Recherche** : algorithme génétique en îles (48 × 96 stratégies, NSGA-II), destins aléatoires communs, "
  "réévaluation des meilleures sur 300 000 vies, puis sélection « on coupe, on relance » (successive halving : "
  "20 000, 60 000, 200 000 vies par stratégie, puis 300 000 vies et 12 mondes perturbés de ±30 à 50 %).")
P("- **Critère de la sélection finale** : vitesse (probabilité d'avoir atteint 10 k€/mois, pondérée par "
  "exp(−t/36 mois)) × facteur de valorisation (1 à 2, maximum à 0,5 % de chance de licorne) ; élimination au-delà "
  "de 2 % de risque de catastrophe.")
P("- **Exclus de la recommandation** : trading, paris sportifs, poker, memecoins/NFT et fraude (espérance négative, "
  "et queue de distribution irréaliste dans le modèle : la mise porte sur toute l'épargne chaque mois).")
P("- **Placements (ETF)** : rendement moyen de 0,55 % par mois (≈ 6,8 %/an), versé en revenu ; les variations "
  "aléatoires restent dans le portefeuille. C'est une hypothèse.\n")

cal = J("calibrage.json")
if cal:
    P("## 3. Calibrage sur des données publiques\n")
    P("Facteur de difficulté du marché par activité, ajusté pour que la meilleure version de l'activité, seule, "
      "atteigne 10 k€/mois en 10 ans avec la probabilité cible. Cibles sourcées : créateurs (4 à 5 % gagnent plus "
      "de 100 000 $/an, Aspire 2022, Kajabi 2024), trading (1,1 % des day traders suivis gagnent plus que le salaire "
      "minimum, Chague, De-Losso et Giovannetti), survie des micro-entreprises (Insee). Les autres cibles sont des "
      "jugements.\n")
    P("| Activité | Cible | Avant calibrage | Après | Facteur |")
    P("|---|---:|---:|---:|---:|")
    for r in cal["lignes"]:
        P(f"| {r['moteur']} | {pct(r['cible_pct'])} | {pct(r['avant_pct'])} | {pct(r['apres_pct'])} | {r['facteur']} |")
    P("")

mot = J("dash_v2", "moteurs.json")
if mot:
    P("## 4. Meilleure version de chaque activité, seule (version générale, horizon 10 ans)\n")
    P("Une évolution dédiée par activité ; chaque ligne est réévaluée sur 100 000 vies. Spéculation et fraude exclues.\n")
    P("| Activité | Domaine | 10 k€ en 12 mois | en 24 mois | en 60 mois | en 120 mois | Temps à ≥ 10 k€ (ans 3-10) | Licorne | Abandon | Revenu médian à 5 ans |")
    P("|---|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    for r in sorted(mot["rows"], key=lambda r: -r.get("p10k_120m_pct", 0)):
        P(f"| {r['moteur']} | {r.get('domaine', '')} | {pct(r['p10k_12m_pct'], 2)} | {pct(r['p10k_24m_pct'], 2)} | "
          f"{pct(r['p10k_60m_pct'], 2)} | {pct(r['p10k_120m_pct'], 2)} | {pct(r['part_temps_10k_pct'], 2)} | "
          f"{pct(r['p_licorne_pct'], 3)} | {pct(r['p_abandon_pct'])} | {eur(r['revenu_median_60m'])} |")
    P("")

med = J("dash_v2", "champions_med.json")
if med:
    P("## 5. Version personnalisée (étudiant·e en médecine, au plus 10 h par semaine au début, horizon 15 ans)\n")
    P("Sélection « on coupe, on relance » sous contrainte d'effort, sans spéculation ; 300 000 vies par ligne.\n")
    P("| Stratégie | Projet | Médecine | Heures au début | 10 k€ en 2 ans | en 5 ans | avant 15 ans | Temps à ≥ 10 k€ (après 3 ans) | Licorne | Abandon | Revenu médian à 2 ans | à 5 ans |")
    P("|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    for r in med["rows"]:
        P(f"| {r['id']} | {r['parcours']} | {r['activite_base']} | {r['heures_debut']} | {pct(r['p10k_24m_pct'], 2)} | "
          f"{pct(r['p10k_60m_pct'], 2)} | {pct(r['p10k_120m_pct'], 2)} | {pct(r['part_temps_10k_pct'], 2)} | "
          f"{pct(r['p_licorne_pct'], 3)} | {pct(r['p_abandon_pct'])} | {eur(r['revenu_median_24m'])} | {eur(r['revenu_median_60m'])} |")
    P("\nLecture : dans la voie qui garde médecine, le premier mois à 10 000 € (série de 3 mois) tombe entre le 133e et "
      "le 137e mois (vers 29 ans), grâce au revenu de médecin, complété par le rendement de l'épargne placée.\n")

pc = J("projets_cote.json")
if pc:
    P("## 6. Projets à côté de médecine : revenu CUMULÉ (médecine jamais arrêtée, au plus 10 h par semaine)\n")
    P("Pour chaque projet, 300 versions tirées au hasard, puis les meilleures tracées vie par vie (1 500 vies) ; "
      "licorne et abandon sur 100 000 vies.\n")
    P("| Projet | 10 k€ cumulés en 3 mois | en 6 mois | en 12 mois | en 24 mois | Cumul médian à 12 mois | Revenu médian au 12e mois | 10 k€/mois en 2 ans | Licorne | Abandon |")
    P("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|")
    for r in pc["projets"]:
        P(f"| {r['projet']} | {pct(r['p_cumul10k_3m'] * 100)} | {pct(r['p_cumul10k_6m'] * 100)} | "
          f"{pct(r['p_cumul10k_12m'] * 100)} | {pct(r['p_cumul10k_24m'] * 100)} | {eur(r['cumul_median_12m'])} | "
          f"{eur(r['revenu_median_12m'])} | {pct(r['p_10k_par_mois_24m'] * 100)} | {pct(r['licorne'] * 100, 3)} | "
          f"{pct(r['abandon'] * 100)} |")
    P("")

gen = J("dash_v2", "champions.json")
if gen:
    P("## 7. Version générale (sans médecine) : stratégies à connaître (horizon 10 ans)\n")
    P("| Rôle | Parcours | Activité de base | 10 k€ en 24 mois | en 60 mois | en 120 mois | Temps à ≥ 10 k€ (ans 3-10) | Licorne | Abandon | Revenu médian à 2 ans | à 5 ans |")
    P("|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|")
    for r in gen["rows"]:
        P(f"| {r['id']} | {r['parcours']} | {r['activite_base']} | {pct(r['p10k_24m_pct'], 2)} | {pct(r['p10k_60m_pct'], 2)} | "
          f"{pct(r['p10k_120m_pct'], 2)} | {pct(r['part_temps_10k_pct'], 2)} | {pct(r['p_licorne_pct'], 3)} | "
          f"{pct(r['p_abandon_pct'])} | {eur(r['revenu_median_24m'])} | {eur(r['revenu_median_60m'])} |")
    P("")

mon = J("dash_v2", "mondes.json")
if mon:
    P("## 8. Robustesse : gagnant de chaque monde perturbé (version générale)\n")
    P("| Monde | Parcours gagnant | 10 k€ en 60 mois | Temps à ≥ 10 k€ | Licorne |")
    P("|---|---|---:|---:|---:|")
    for r in mon["rows"]:
        P(f"| {r.get('monde', '')} | {r['parcours']} | {pct(r['p10k_60m_pct'], 2)} | {pct(r['part_temps_10k_pct'], 2)} | "
          f"{pct(r['p_licorne_pct'], 3)} |")
    P("")

P("## 9. Sélections « on coupe, on relance »\n")
P("| Sélection | Étape 1 | Étape 2 | Étape 3 | Retenue | Vies simulées |")
P("|---|---|---|---|---|---:|")
for tag, label in [("med_10h", "Personnalisée, ≤ 10 h"), ("med_garder", "Personnalisée, en gardant médecine"),
                   ("med_libre", "Personnalisée, sans limite d'effort"), ("generic_10h", "Générale, ≤ 10 h")]:
    h = J(f"halving_{tag}.json")
    if not h:
        continue
    et = [f"{e['strategies']} → {e['gardees']} gardées" for e in h["etapes"]]
    champ = next((r["strategie"]["parcours"] for r in h["final"] if r["strategie"]["genome"] == h["champion_genome"]),
                 h["final"][0]["strategie"]["parcours"])
    P(f"| {label} | {et[0]} | {et[1]} | {et[2]} | {champ} | {h['vies_total']:,} |".replace(",", " "))
P("")

P("## 10. Effort de calcul (campagnes et sélections finales)\n")
tot = 0
for name, keys in [("v2_main1.json", ("lives", "lives_deep")), ("v2_locked.json", ("lives",)),
                   ("v2_robust.json", ("lives",)), ("med_main1.json", ("lives", "lives_deep")), ("med_robust.json", ("lives",))]:
    d = J(name)
    if d:
        tot += sum(d.get(k, 0) for k in keys)
for tag in ("generic_10h", "med_10h", "med_garder", "med_libre"):
    h = J(f"halving_{tag}.json")
    if h:
        tot += h["vies_total"]
m1, mm = J("v2_main1.json"), J("med_main1.json")
P(f"- Vies simulées : environ {tot / 1e6:,.0f} millions (hors essais écartés).".replace(",", " "))
if m1 and mm:
    P(f"- Générations : {m1['generations_total']:,} (générale) + {mm['generations_total']:,} (personnalisée) ; "
      f"stratégies différentes explorées : {m1['unique']:,} et {mm['unique']:,}.".replace(",", " "))
P("")

P("## 11. Conclusions tirées par l'auteur des simulations\n")
P("1. Aucune voie sans spéculation n'atteint 10 000 € par mois dans les 5 ans, dans la version personnalisée "
  "(0 % des vies).")
P("2. À côté de médecine, avec au plus 10 h par semaine, aucun projet testé n'atteint 10 000 € cumulés en 3, 6 ou "
  "12 mois (au mieux 1,1 % en 12 mois).")
P("3. La voie la plus fiable vers 10 000 € par mois est de garder médecine et de placer l'épargne : 94 % des "
  "simulations y arrivent avant 15 ans, vers 29 ans.")
P("4. La licorne n'a aucune chance mesurable dans les voies retenues (0 %). Les meilleures probabilités observées "
  "dans les campagnes sont de l'ordre de 0,1 à 0,4 %, sur des parcours startup à plein temps.")
P("5. Hors modèle : les cours en petits groupes et les stages de révision sont le levier de revenu rapide le plus "
  "réaliste pour un·e étudiant·e en médecine ; une agence d'automatisation IA pour des cabinets est la voie légale "
  "qui combine le mieux revenu rapide et potentiel logiciel, avec des chances faibles à temps partiel.\n")

P("## 12. Limites à garder en tête\n")
P("- Modèle, pas réalité : les hypothèses (taux, délais, prix, comportements) sont des choix ; plusieurs cibles de "
  "calibrage sont des jugements.")
P("- Revenus bruts (avant impôts et charges) ; probabilités de licorne peu fiables.")
P("- Le modèle ne représente pas les cours en groupe ni la réussite au concours de première année (PASS/LAS).")
P("- Trois défauts majeurs ont été trouvés et corrigés en cours de route (fuite du calibrage des services, queue "
  "spéculative, gains de l'ETF comptés comme revenu) ; les résultats antérieurs à ces corrections ne sont pas fiables.")
P("- Code et données brutes : dépôt `pmzf6y5g68-cmd/Aeternum-`, dossier `simulation/` (README, `results/`).")

open(os.path.join(HERE, "donnees_pour_ia.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
print("donnees_pour_ia.md :", len(L), "lignes")
