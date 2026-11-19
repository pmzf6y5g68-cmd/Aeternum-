#!/bin/bash
# Campagne complète (≈ 1 h sur 4 cœurs)
set -e
cd "$(dirname "$0")"
mkdir -p results logs
python3 evolve.py main   --pop 500 --gens 2500 --M 256 --seed 1 --deep 200000 > logs/main1.log 2>&1
python3 evolve.py locked --pop 200 --gens 300  --M 192 --seed 7 --deep 100000 > logs/locked.log 2>&1
python3 evolve.py robust --pop 250 --gens 400  --M 160 --seed 3 --worlds 24   > logs/robust.log 2>&1
python3 evolve.py main   --pop 500 --gens 2500 --M 256 --seed 2 --deep 200000 > logs/main2.log 2>&1
echo DONE > logs/done
