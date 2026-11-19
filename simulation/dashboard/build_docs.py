"""Prépare les documents du tableau de bord (méta, jeux de données, page) à partir des fichiers téléversés."""
import datetime
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "docs")

DATASETS = {
    "campagne": ("Résumé de la campagne", "Nombre de générations, de vies simulées et de mondes perturbés, et stratégie gagnante."),
    "champions": ("Finalistes des évolutions", "Trois meilleurs parcours distincts de chaque évolution, réévalués sur 200 000 vies chacun ; la première ligne est la stratégie gagnante retenue."),
    "moteurs": ("Meilleure version de chaque voie", "Pour chacun des moteurs de revenus (la fraude, témoin de contrôle, n'est pas publiée), la meilleure stratégie trouvée par une évolution dédiée."),
    "calibrage": ("Calibrage sur les données publiques", "Pour chaque activité calée : cible de probabilité, probabilité du modèle avant et après calibrage, et facteur de difficulté retenu."),
    "champions_med": ("Ta stratégie (version personnalisée)", "Stratégie retenue par la sélection « on coupe, on relance », comparée à garder médecine et à la référence médecine seule."),
    "trajectoire_med": ("Revenu mois par mois, version personnalisée", "Quantiles du revenu mensuel sur 15 ans, de 18 à 33 ans, pour la stratégie retenue et les références, sur 2 000 vies tracées."),
    "variantes_med": ("Et si… (version personnalisée)", "La stratégie retenue avec un seul réglage changé, réévaluée sur 100 000 vies par variante."),
    "evolution": ("Score par génération", "Meilleur score et score moyen de la population, toutes les 5 générations, pour les trois évolutions principales."),
    "especes": ("Parcours dans la population", "Part de la population occupée par chaque parcours, toutes les 10 générations (évolution 1)."),
    "courbe10k": ("Course aux 10 k€/mois", "Probabilité cumulée d'avoir tenu 10 k€/mois pendant 3 mois, mois par mois, par stratégie."),
    "trajectoire": ("Revenu mois par mois sur 10 ans", "Quantiles du bénéfice mensuel du fondateur de la stratégie gagnante, mois par mois, sur 5 000 vies tracées."),
    "variantes": ("Effet d'un seul réglage changé", "La stratégie gagnante avec un seul gène modifié, réévaluée sur 100 000 vies par variante."),
    "mondes": ("Gagnants des mondes perturbés", "Stratégie gagnante de chaque évolution relancée avec des hypothèses perturbées de ±30 à 50 %."),
}


def main(blob_map_path):
    blobs = json.load(open(blob_map_path))
    os.makedirs(OUT, exist_ok=True)
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    json.dump({"title": "Évolution Aeternum", "lang": "fr"}, open(os.path.join(OUT, "dash_meta.json"), "w"), ensure_ascii=False)
    for ds, (title, desc) in DATASETS.items():
        if ds not in blobs:
            continue
        doc = {"title": title,
               "description": desc + " Sortie de la simulation écrite par Claude (hypothèses dans README.md).",
               "source": {"kind": "file", "url": blobs[ds], "name": ds + ".json", "format": "json"},
               "updated": {"at": now, "by": "Claude"}, "fixed": True}
        json.dump(doc, open(os.path.join(OUT, f"ds_{ds}.json"), "w"), ensure_ascii=False)
    html = open(os.path.join(HERE, "index_v2.html"), encoding="utf-8").read()
    json.dump({"text": html}, open(os.path.join(OUT, "files_index.json"), "w"), ensure_ascii=False)
    print("ok", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main(sys.argv[1])
