#!/bin/bash
# Sélection finale sans moteurs spéculatifs ni fraude (vitesse pondérée × valorisation), quatre réglages.
set -e
cd "$(dirname "$0")"
mkdir -p results logs
python3 halving.py med --hstart-max 1 --sans-speculation --tag med_10h > logs/halving_med_10h.log 2>&1
python3 halving.py med --hstart-max 1 --sans-speculation --garder-medecine --tag med_garder > logs/halving_med_garder.log 2>&1
python3 halving.py generic --hstart-max 1 --sans-speculation --tag generic_10h > logs/halving_generic_10h.log 2>&1
python3 halving.py med --hstart-max 3 --sans-speculation --tag med_libre > logs/halving_med_libre.log 2>&1
echo DONE > logs/halving_done
