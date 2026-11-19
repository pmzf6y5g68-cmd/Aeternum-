#!/bin/bash
# Chaîne finale sur le modèle corrigé (revenu de l'ETF réalisable) : campagnes, sélections, exports.
set -e
cd "$(dirname "$0")"
mkdir -p results logs
for f in v2_main1 v2_locked v2_robust med_main1 med_robust halving_med_10h halving_med_garder halving_generic_10h halving_med_libre med_variants v2_variants v2_trajectoire; do
  if [ -f "results/$f.json" ]; then mv "results/$f.json" "results/${f}_avant_correctif_etf.json"; fi
done
python3 evolve2.py main --islands 48 --pop 96 --M 16 --nmax 512 --seconds 600 --seed 1 --deep 300000 > logs/v2_main.log 2>&1
python3 evolve2.py locked --islands 2 --pop 64 --M 16 --nmax 512 --gens 300 --seed 7 --deep 100000 > logs/v2_locked.log 2>&1
python3 evolve2.py robust --islands 4 --pop 64 --M 16 --nmax 512 --gens 200 --seed 3 --worlds 8 --deep 40000 > logs/v2_robust.log 2>&1
python3 evolve2_med.py main --islands 48 --pop 96 --M 16 --nmax 512 --seconds 600 --seed 1 --deep 300000 > logs/med_main.log 2>&1
python3 evolve2_med.py robust --islands 4 --pop 64 --M 16 --nmax 512 --gens 200 --seed 3 --worlds 8 --deep 40000 > logs/med_robust.log 2>&1
echo DONE > logs/campagne2_done
python3 halving.py med --hstart-max 1 --sans-speculation --tag med_10h > logs/halving_med_10h.log 2>&1
python3 halving.py med --hstart-max 1 --sans-speculation --garder-medecine --tag med_garder > logs/halving_med_garder.log 2>&1
python3 halving.py generic --hstart-max 1 --sans-speculation --tag generic_10h > logs/halving_generic_10h.log 2>&1
python3 export_v2.py > logs/export2_a.log 2>&1
G=$(python3 -c "import json; print(json.load(open('results/dash_v2/champions.json'))['rows'][0]['genome'].replace(' ', ','))")
python3 variants_v2.py "[$G]" 100000 > logs/variants_v2.log 2>&1
python3 trajectory.py "[[\"Retenue\", [$G]]]" 5000 v2_trajectoire.json > logs/traj_v2.log 2>&1
python3 export_v2.py > logs/export2_b.log 2>&1
python3 halving.py med --hstart-max 3 --sans-speculation --tag med_libre > logs/halving_med_libre.log 2>&1
GM=$(python3 -c "import json; print(','.join(str(x) for x in json.load(open('results/halving_med_10h.json'))['champion_genome']))")
python3 variants_med.py "[$GM]" 100000 > logs/variants_med.log 2>&1
python3 export_med.py > logs/export_med.log 2>&1
python3 synthese.py > logs/synthese.log 2>&1
echo DONE > logs/final2_done
