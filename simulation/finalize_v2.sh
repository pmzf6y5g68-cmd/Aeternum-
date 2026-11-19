#!/bin/bash
# Après la campagne v2 : choisir les stratégies, analyse « et si », trajectoires, puis jeux de données du tableau de bord.
set -e
cd "$(dirname "$0")"
python3 export_v2.py > logs/v2_export1.log 2>&1
G=$(python3 -c "import json; print(json.load(open('results/dash_v2/champions.json'))['rows'][0]['genome'].replace(' ', ','))")
python3 variants_v2.py "[$G]" 100000 > logs/v2_variants.log 2>&1
python3 trajectory.py "[[\"Meilleur compromis\", [$G]]]" 5000 v2_trajectoire.json > logs/v2_traj.log 2>&1
python3 export_v2.py > logs/v2_export2.log 2>&1
echo "FINAL OK $G"
