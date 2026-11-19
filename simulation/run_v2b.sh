#!/bin/bash
# Fin de campagne v2 après le correctif « crédibilité » (≈ 50 min)
cd "$(dirname "$0")"
python3 evolve2.py main --islands 48 --pop 96 --M 16 --nmax 512 --seconds 2100 --seed 1 --deep 300000 > logs/v2_main.log 2>&1 &
P1=$!
python3 evolve2.py locked --islands 2 --pop 64 --M 16 --nmax 512 --gens 250 --seed 7 --deep 100000 \
  --engines $(python3 -c "print(','.join(str(e) for e in range(13, 50)))") > logs/v2_locked.log 2>&1
wait $P1
python3 evolve2.py robust --islands 4 --pop 64 --M 16 --nmax 512 --gens 300 --seed 3 --worlds 12 --deep 40000 > logs/v2_robust.log 2>&1
./finalize_v2.sh
echo DONE > logs/v2_done
