#!/bin/bash
# Campagne finale sur le modèle calibré (env. 1 h 15 sur 4 cœurs) :
# 1) attend la fin de la calibration ; 2) relance la campagne générique et la campagne personnalisée ;
# 3) sélection « on coupe, on relance » (halving.py) sous trois réglages d'effort.
set -e
cd "$(dirname "$0")"
mkdir -p results logs
until grep -q "terminé en" logs/calibrage.log 2>/dev/null; do sleep 20; done

for f in v2_main1 v2_locked v2_robust v2_variants v2_trajectoire med_main1 med_robust; do
  if [ -f "results/$f.json" ]; then mv "results/$f.json" "results/${f}_avant_calibrage.json"; fi
done
rm -f results/v2_main1_checkpoint.json results/med_main1_checkpoint.json logs/v2_done logs/med_done

python3 evolve2.py main --islands 48 --pop 96 --M 16 --nmax 512 --seconds 1200 --seed 1 --deep 300000 > logs/v2_main.log 2>&1
python3 evolve2.py locked --islands 2 --pop 64 --M 16 --nmax 512 --gens 400 --seed 7 --deep 100000 > logs/v2_locked.log 2>&1
python3 evolve2.py robust --islands 4 --pop 64 --M 16 --nmax 512 --gens 300 --seed 3 --worlds 12 --deep 40000 > logs/v2_robust.log 2>&1
python3 evolve2_med.py main --islands 48 --pop 96 --M 16 --nmax 512 --seconds 1200 --seed 1 --deep 300000 > logs/med_main.log 2>&1
python3 evolve2_med.py robust --islands 4 --pop 64 --M 16 --nmax 512 --gens 250 --seed 3 --worlds 8 --deep 30000 > logs/med_robust.log 2>&1
echo DONE > logs/campagne_done

python3 halving.py med --hstart-max 1 --tag med_10h > logs/halving_med_10h.log 2>&1
python3 halving.py med --hstart-max 3 --tag med_libre > logs/halving_med_libre.log 2>&1
python3 halving.py generic --hstart-max 1 --tag generic_10h > logs/halving_generic_10h.log 2>&1
echo DONE > logs/halving_done
