#!/bin/bash
# Simulation personnalisée : étudiant(e) en médecine de 18 ans près de Paris (≈ 35 min)
set -e
cd "$(dirname "$0")"
python3 evolve2_med.py main --islands 48 --pop 96 --M 16 --nmax 512 --seconds 1500 --seed 1 --deep 200000 > logs/med_main.log 2>&1
python3 evolve2_med.py robust --islands 4 --pop 64 --M 16 --nmax 512 --gens 250 --seed 3 --worlds 8 --deep 30000 > logs/med_robust.log 2>&1
echo DONE > logs/med_done
