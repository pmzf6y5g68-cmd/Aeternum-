#!/bin/bash
# Campagne v2 (≈ 1 h 40 sur 4 cœurs)
set -e
cd "$(dirname "$0")"
mkdir -p results logs
rm -f logs/v2_done
python3 evolve2.py main   --islands 48 --pop 96 --M 16 --nmax 512 --seconds 3600 --seed 1 --deep 300000 > logs/v2_main.log 2>&1
python3 evolve2.py locked --islands 2 --pop 64 --M 16 --nmax 512 --gens 500 --seed 7 --deep 100000 > logs/v2_locked.log 2>&1
python3 evolve2.py robust --islands 4 --pop 64 --M 16 --nmax 512 --gens 600 --seed 3 --worlds 24 --deep 40000 > logs/v2_robust.log 2>&1
echo DONE > logs/v2_done
