# Données des simulations « Aeternum » (à transmettre à une autre IA)

Fichier généré automatiquement par `simulation/export_pour_ia.py` à partir des résultats du dépôt. Les chiffres sont des sorties de simulation (Monte Carlo), pas des mesures du monde réel.

## 1. Contexte et objectif

- **Profil simulé (version personnalisée)** : 18 ans, étudiant·e en médecine près de Paris, 1 500 € d'épargne, quelques bases en code, aucun réseau. Ne veut pas arrêter médecine ; projet à côté.
- **Profil simulé (version générale)** : 18 ans, seul, sans expérience ni réseau, en France, 1 500 € d'épargne.
- **Objectifs** : atteindre 10 000 € par mois (revenu brut avant impôts, tenu 3 mois de suite) le plus vite possible, avec peu d'heures au début, et garder un potentiel de valorisation (licorne = entreprise valorisée au moins 1 milliard de dollars).

## 2. Modèle

- **Vie simulée** mois par mois : 120 mois (version générale) ou 180 mois (version personnalisée, de 18 à 33 ans). Tirages au hasard : talent, ténacité, chance commerciale, qualité d'entreprise, chocs de marché, burn-out, associés, levées.
- **50 moteurs de revenus** (emploi, services, agences, freelance, closer, startups IA/SaaS/deeptech/medtech/edtech…, commerce, audience, spéculation, placements, fraude comme témoin non publié).
- **Stratégie = génome de 23 gènes** : jusqu'à 3 phases (moteurs), déclencheurs de passage, activité de base, heures au début (5/10/15/20 h par semaine), seuil de passage à temps plein, secteur, canal, prix, financement, géographie, associé, etc.
- **Médecine (version personnalisée)** : 3 ans sans revenu, externat (350 €/mois), internat (2 100 €/mois), puis médecin vers 9 à 11 ans (8 000 € bruts pour un généraliste, 12 000 € pour un spécialiste, +4 %/an ; 40 % de spécialistes). Charge : 45 h/semaine en premier cycle, 50 h en externat, 55 h en internat.
- **Recherche** : algorithme génétique en îles (48 × 96 stratégies, NSGA-II), destins aléatoires communs, réévaluation des meilleures sur 300 000 vies, puis sélection « on coupe, on relance » (successive halving : 20 000, 60 000, 200 000 vies par stratégie, puis 300 000 vies et 12 mondes perturbés de ±30 à 50 %).
- **Critère de la sélection finale** : vitesse (probabilité d'avoir atteint 10 k€/mois, pondérée par exp(−t/36 mois)) × facteur de valorisation (1 à 2, maximum à 0,5 % de chance de licorne) ; élimination au-delà de 2 % de risque de catastrophe.
- **Exclus de la recommandation** : trading, paris sportifs, poker, memecoins/NFT et fraude (espérance négative, et queue de distribution irréaliste dans le modèle : la mise porte sur toute l'épargne chaque mois).
- **Placements (ETF)** : rendement moyen de 0,55 % par mois (≈ 6,8 %/an), versé en revenu ; les variations aléatoires restent dans le portefeuille. C'est une hypothèse.

## 3. Calibrage sur des données publiques

Facteur de difficulté du marché par activité, ajusté pour que la meilleure version de l'activité, seule, atteigne 10 k€/mois en 10 ans avec la probabilité cible. Cibles sourcées : créateurs (4 à 5 % gagnent plus de 100 000 $/an, Aspire 2022, Kajabi 2024), trading (1,1 % des day traders suivis gagnent plus que le salaire minimum, Chague, De-Losso et Giovannetti), survie des micro-entreprises (Insee). Les autres cibles sont des jugements.

| Activité | Cible | Avant calibrage | Après | Facteur |
|---|---:|---:|---:|---:|
| Freelance | 10.0 % | 15.8 % | 9.9 % | 0.5428 |
| Agence IA | 6.0 % | 25.5 % | 6.0 % | 0.4442 |
| Closer | 4.0 % | 26.9 % | 4.0 % | 0.6084 |
| Micro-SaaS | 3.0 % | 14.2 % | 3.0 % | 0.3916 |
| Startup IA verticale | 5.0 % | 12.1 % | 5.0 % | 0.5458 |
| E-commerce | 2.0 % | 13.9 % | 2.0 % | 0.1191 |
| Contenu | 3.0 % | 15.0 % | 3.0 % | 0.4377 |
| Info-produits | 5.0 % | 34.3 % | 5.1 % | 0.3582 |
| Trading | 1.0 % | 7.8 % | 1.1 % | 0.6198 |
| Agence réseaux sociaux | 4.0 % | 23.4 % | 4.0 % | 0.2822 |
| Conciergerie Airbnb | 4.0 % | 15.1 % | 4.0 % | 0.389 |
| Mandataire immobilier | 5.0 % | 29.4 % | 5.1 % | 0.1511 |
| Artisan du bâtiment | 6.0 % | 26.4 % | 6.1 % | 0.4675 |
| Marque e-commerce | 4.0 % | 16.9 % | 4.2 % | 0.7838 |
| Streaming | 0.5 % | 1.7 % | 0.5 % | 0.7025 |
| Sites SEO | 2.0 % | 8.9 % | 1.9 % | 0.5408 |
| Newsletter | 2.0 % | 13.1 % | 1.9 % | 0.4194 |
| Musique | 1.0 % | 5.2 % | 1.0 % | 0.2522 |
| Paris sportifs | 0.5 % | 6.3 % | 0.5 % | 0.6385 |
| Poker | 1.0 % | 16.6 % | 1.0 % | 0.5163 |
| Memecoins / NFT | 1.0 % | 10.4 % | 0.9 % | 0.5939 |

## 4. Meilleure version de chaque activité, seule (version générale, horizon 10 ans)

Une évolution dédiée par activité ; chaque ligne est réévaluée sur 100 000 vies. Spéculation et fraude exclues.

| Activité | Domaine | 10 k€ en 12 mois | en 24 mois | en 60 mois | en 120 mois | Temps à ≥ 10 k€ (ans 3-10) | Licorne | Abandon | Revenu médian à 5 ans |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Freelance | Services | 0.00 % | 0.00 % | 1.64 % | 9.95 % | 3.93 % | 0.000 % | 83.6 % | 2 226 € |
| Edtech | Startup tech | 0.00 % | 0.01 % | 0.87 % | 6.38 % | 1.99 % | 0.020 % | 74.9 % | 2 058 € |
| Artisan du bâtiment | Services | 0.00 % | 0.00 % | 1.40 % | 5.88 % | 2.42 % | 0.000 % | 74.9 % | 2 774 € |
| Agence IA | Services | 0.01 % | 0.34 % | 3.56 % | 5.27 % | 2.63 % | 0.000 % | 85.1 % | 2 304 € |
| Info-produits | Audience | 0.01 % | 0.03 % | 0.95 % | 4.98 % | 2.22 % | 0.000 % | 84.5 % | 2 155 € |
| Mandataire immobilier | Services | 0.00 % | 0.00 % | 0.64 % | 4.72 % | 1.97 % | 0.000 % | 86.0 % | 2 168 € |
| Closer | Services | 0.00 % | 0.07 % | 1.65 % | 4.08 % | 2.55 % | 0.000 % | 57.1 % | 2 732 € |
| Marque e-commerce | Commerce | 0.00 % | 0.00 % | 0.18 % | 3.91 % | 1.23 % | 0.000 % | 84.3 % | 2 076 € |
| Conciergerie Airbnb | Services | 0.00 % | 0.00 % | 0.46 % | 3.39 % | 1.38 % | 0.000 % | 88.2 % | 2 220 € |
| Marketplace | Startup tech | 0.00 % | 0.00 % | 0.24 % | 3.22 % | 0.85 % | 0.080 % | 79.0 % | 1 995 € |
| Agence réseaux sociaux | Services | 0.00 % | 0.01 % | 0.53 % | 3.15 % | 1.35 % | 0.000 % | 88.5 % | 2 109 € |
| Montage vidéo / UGC | Services | 0.00 % | 0.04 % | 1.00 % | 2.93 % | 1.60 % | 0.000 % | 87.0 % | 2 243 € |
| Startup IA verticale | Startup tech | 0.00 % | 0.00 % | 0.07 % | 2.78 % | 0.55 % | 0.030 % | 77.8 % | 2 036 € |
| Contenu | Audience | 0.00 % | 0.01 % | 0.25 % | 2.65 % | 1.01 % | 0.000 % | 86.8 % | 1 985 € |
| Micro-SaaS | Startup tech | 0.00 % | 0.00 % | 0.33 % | 2.65 % | 0.80 % | 0.000 % | 79.2 % | 1 994 € |
| Coaching sportif | Services | 0.00 % | 0.00 % | 0.44 % | 2.51 % | 1.22 % | 0.000 % | 87.9 % | 2 265 € |
| App IA B2C | Startup tech | 0.00 % | 0.00 % | 0.50 % | 2.50 % | 0.73 % | 0.090 % | 81.5 % | 2 038 € |
| Sites SEO | Audience | 0.00 % | 0.01 % | 0.70 % | 1.94 % | 0.86 % | 0.000 % | 89.0 % | 1 969 € |
| E-commerce | Commerce | 0.00 % | 0.13 % | 0.95 % | 1.83 % | 0.17 % | 0.000 % | 93.5 % | 2 376 € |
| Newsletter | Audience | 0.00 % | 0.01 % | 0.30 % | 1.75 % | 0.75 % | 0.000 % | 89.8 % | 1 960 € |
| Jeux vidéo | Startup tech | 0.00 % | 0.00 % | 0.23 % | 1.67 % | 0.48 % | 0.040 % | 83.2 % | 2 105 € |
| Musique | Audience | 0.03 % | 0.10 % | 0.48 % | 0.99 % | 0.55 % | 0.000 % | 90.3 % | 1 956 € |
| Voitures d'occasion | Commerce | 0.00 % | 0.00 % | 0.00 % | 0.53 % | 0.16 % | 0.000 % | 88.0 % | 2 109 € |
| Streaming | Audience | 0.00 % | 0.01 % | 0.07 % | 0.34 % | 0.13 % | 0.000 % | 92.5 % | 1 934 € |
| Outils IA dev | Startup tech | 0.00 % | 0.00 % | 0.02 % | 0.27 % | 0.06 % | 0.050 % | 83.0 % | 2 092 € |
| Cleantech | Startup tech | 0.00 % | 0.00 % | 0.00 % | 0.03 % | 0.00 % | 0.000 % | 89.6 % | 2 120 € |
| Soirées / événements | Services | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.01 % | 0.000 % | 89.2 % | 2 092 € |
| Salariat tech | Emploi | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 75.7 % | 2 408 € |
| Fintech | Startup tech | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 79.5 % | 2 519 € |
| Deeptech | Startup tech | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 93.6 % | 2 023 € |
| Cours particuliers | Services | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 77.5 % | 2 324 € |
| Services à domicile | Services | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 93.1 % | 2 168 € |
| Réparation smartphones | Services | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 80.1 % | 2 247 € |
| Photo / vidéo mariages | Services | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 92.4 % | 1 997 € |
| Food truck | Services | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 92.3 % | 1 917 € |
| Medtech | Startup tech | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 100.0 % | 2 245 € |
| Défense | Startup tech | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 92.7 % | 1 914 € |
| Hardware / robotique | Startup tech | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 92.7 % | 1 930 € |
| Achat-revente | Commerce | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 93.6 % | 2 049 € |
| Print on demand | Commerce | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 93.4 % | 2 234 € |
| Alternance | Emploi | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 70.7 % | 1 867 € |
| CDI | Emploi | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 26.7 % | 1 628 € |
| Livreur / VTC | Emploi | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 92.2 % | 2 317 € |
| Bourse (ETF) | Placements | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 0.0 % | 2 700 € |
| Immobilier locatif | Placements | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.00 % | 0.000 % | 0.0 % | 2 074 € |

## 5. Version personnalisée (étudiant·e en médecine, au plus 10 h par semaine au début, horizon 15 ans)

Sélection « on coupe, on relance » sous contrainte d'effort, sans spéculation ; 300 000 vies par ligne.

| Stratégie | Projet | Médecine | Heures au début | 10 k€ en 2 ans | en 5 ans | avant 15 ans | Temps à ≥ 10 k€ (après 3 ans) | Licorne | Abandon | Revenu médian à 2 ans | à 5 ans |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Ta stratégie retenue (≤ 10 h par semaine au début) | Bourse (ETF) | médecine (année de césure si le projet décolle) | 5 h | 0.00 % | 0.00 % | 93.77 % | 29.22 % | 0.000 % | 15.4 % | 0 € | 350 € |
| Alternative : arrêter médecine (≤ 10 h) | Alternance → Salariat tech → Marque e-commerce | arrêter médecine → petit job | 10 h | 0.00 % | 0.00 % | 76.79 % | 32.23 % | 0.000 % | 20.0 % | 1 037 € | 4 324 € |
| Référence : médecine seule | Bourse (ETF) | médecine (arrêt si le projet décolle) | 5 h | 0.00 % | 0.00 % | 93.77 % | 29.30 % | 0.000 % | 15.4 % | 0 € | 350 € |

Lecture : dans la voie qui garde médecine, le premier mois à 10 000 € (série de 3 mois) tombe entre le 133e et le 137e mois (vers 29 ans), grâce au revenu de médecin, complété par le rendement de l'épargne placée.

## 6. Projets à côté de médecine : revenu CUMULÉ (médecine jamais arrêtée, au plus 10 h par semaine)

Pour chaque projet, 300 versions tirées au hasard, puis les meilleures tracées vie par vie (1 500 vies) ; licorne et abandon sur 100 000 vies.

| Projet | 10 k€ cumulés en 3 mois | en 6 mois | en 12 mois | en 24 mois | Cumul médian à 12 mois | Revenu médian au 12e mois | 10 k€/mois en 2 ans | Licorne | Abandon |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Cours particuliers | 0.0 % | 0.0 % | 0.0 % | 19.0 % | 1 744 € | 166 € | 0.0 % | 0.000 % | 92.5 % |
| Cours particuliers → Edtech | 0.0 % | 0.0 % | 0.0 % | 7.6 % | 1 167 € | 130 € | 0.0 % | 0.000 % | 91.3 % |
| Cours particuliers → Startup IA verticale | 0.0 % | 0.0 % | 0.0 % | 11.3 % | 1 043 € | 128 € | 0.0 % | 0.000 % | 93.2 % |
| Info-produits → Edtech | 0.1 % | 0.5 % | 1.1 % | 3.6 % | -763 € | -63 € | 0.1 % | 0.000 % | 92.6 % |
| Agence IA → Startup IA verticale | 0.0 % | 0.0 % | 0.0 % | 0.0 % | -1 500 € | -50 € | 0.0 % | 0.000 % | 92.7 % |
| Freelance → Micro-SaaS | 0.0 % | 0.0 % | 0.2 % | 2.7 % | 269 € | -60 € | 0.0 % | 0.000 % | 92.9 % |
| Contenu → Info-produits | 0.0 % | 0.0 % | 0.3 % | 2.1 % | -595 € | -56 € | 0.1 % | 0.000 % | 92.0 % |

## 7. Version générale (sans médecine) : stratégies à connaître (horizon 10 ans)

| Rôle | Parcours | Activité de base | 10 k€ en 24 mois | en 60 mois | en 120 mois | Temps à ≥ 10 k€ (ans 3-10) | Licorne | Abandon | Revenu médian à 2 ans | à 5 ans |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Retenue : vitesse × valorisation (≤ 10 h au début) | Alternance → Salariat tech → Marque e-commerce | rien à côté (chez les parents) | 0.00 % | 0.00 % | 52.85 % | 18.45 % | 0.000 % | 14.8 % | 1 037 € | 4 242 € |
| Meilleur compromis (critère de la campagne) | CDI → Print on demand → App IA B2C | petit job à temps partiel | 0.00 % | 0.00 % | 6.29 % | 1.35 % | 0.370 % | 57.3 % | 1 519 € | -15 € |
| La plus rapide vers 10 k€ | Alternance → Salariat tech → Marque e-commerce | rien à côté (chez les parents) | 0.00 % | 0.00 % | 59.29 % | 21.02 % | 0.000 % | 16.3 % | 1 037 € | 4 242 € |
| La plus pérenne | Alternance → Salariat tech → Marque e-commerce | rien à côté (chez les parents) | 0.00 % | 0.00 % | 59.29 % | 21.02 % | 0.000 % | 16.3 % | 1 037 € | 4 242 € |
| Le plus gros potentiel licorne | CDI → Print on demand → App IA B2C | petit job à temps partiel | 0.00 % | 0.00 % | 6.29 % | 1.35 % | 0.370 % | 57.3 % | 1 519 € | -15 € |
| Finaliste 1 | Alternance → Montage vidéo / UGC → App IA B2C | petit job à temps partiel | 0.00 % | 0.12 % | 5.92 % | 1.42 % | 0.280 % | 61.5 % | 1 037 € | 2 006 € |
| Finaliste 2 | Alternance → Print on demand → App IA B2C | petit job à temps partiel | 0.00 % | 0.36 % | 7.09 % | 1.90 % | 0.260 % | 68.5 % | 1 037 € | 1 213 € |
| Finaliste 3 | Alternance → Salariat tech → App IA B2C | petit job à temps partiel | 0.00 % | 0.19 % | 8.87 % | 2.31 % | 0.230 % | 41.4 % | 1 037 € | 4 034 € |
| Finaliste 4 | Salariat tech → App IA B2C | rien à côté (chez les parents) | 0.00 % | 0.22 % | 5.61 % | 1.47 % | 0.220 % | 47.3 % | 2 670 € | 3 051 € |
| Finaliste 5 | Alternance → Cours particuliers → App IA B2C | petit job à temps partiel | 0.00 % | 0.11 % | 5.17 % | 1.25 % | 0.220 % | 64.5 % | 1 037 € | 1 919 € |
| Finaliste 6 | Alternance → Réparation smartphones → App IA B2C | petit job à temps partiel | 0.00 % | 0.27 % | 7.45 % | 2.04 % | 0.170 % | 61.1 % | 1 037 € | 2 007 € |
| Finaliste 7 | Salariat tech → Soirées / événements → App IA B2C | rien à côté (chez les parents) | 0.00 % | 0.08 % | 6.62 % | 1.64 % | 0.180 % | 46.8 % | 2 637 € | 3 002 € |
| Finaliste 8 | Salariat tech → Bourse (ETF) → App IA B2C | petit job à temps partiel | 0.00 % | 0.02 % | 6.45 % | 1.53 % | 0.180 % | 43.6 % | 2 669 € | 2 960 € |
| Finaliste 9 | CDI → Salariat tech → App IA B2C | rien à côté (chez les parents) | 0.00 % | 0.50 % | 8.48 % | 2.30 % | 0.160 % | 43.7 % | 1 519 € | 3 196 € |
| Finaliste 10 | Salariat tech → E-commerce → App IA B2C | petit job à temps partiel | 0.00 % | 0.00 % | 5.44 % | 1.14 % | 0.180 % | 42.7 % | 2 669 € | 3 026 € |

## 8. Robustesse : gagnant de chaque monde perturbé (version générale)

| Monde | Parcours gagnant | 10 k€ en 60 mois | Temps à ≥ 10 k€ | Licorne |
|---|---|---:|---:|---:|
| Monde 1 | Food truck → Alternance → Startup IA verticale | 0.00 % | 0.57 % | 0.040 % |
| Monde 2 | Salariat tech → Marque e-commerce → Edtech | 0.02 % | 1.64 % | 0.020 % |
| Monde 3 | Alternance → Print on demand → Startup IA verticale | 0.01 % | 3.39 % | 0.010 % |
| Monde 4 | Closer → Edtech → App IA B2C | 12.48 % | 2.51 % | 0.210 % |
| Monde 5 | Salariat tech → Artisan du bâtiment → Paris sportifs | 0.00 % | 8.04 % | 0.000 % |
| Monde 6 | CDI → Contenu → Startup IA verticale | 0.33 % | 4.72 % | 0.110 % |
| Monde 7 | App IA B2C | 0.03 % | 0.26 % | 0.020 % |
| Monde 8 | Salariat tech → Paris sportifs | 5.62 % | 7.11 % | 0.000 % |

## 9. Sélections « on coupe, on relance »

| Sélection | Étape 1 | Étape 2 | Étape 3 | Retenue | Vies simulées |
|---|---|---|---|---|---:|
| Personnalisée  ≤ 10 h | 487 → 122 gardées | 402 → 121 gardées | 366 → 128 gardées | Bourse (ETF) | 115 220 000 |
| Personnalisée  en gardant médecine | 636 → 159 gardées | 455 → 136 gardées | 398 → 139 gardées | Bourse (ETF) | 127 780 000 |
| Personnalisée  sans limite d'effort | 668 → 167 gardées | 484 → 145 gardées | 434 → 152 gardées | Bourse (ETF) | 137 360 000 |
| Générale  ≤ 10 h | 654 → 164 gardées | 419 → 126 gardées | 374 → 131 gardées | Alternance → Salariat tech → Marque e-commerce | 121 180 000 |

## 10. Effort de calcul (campagnes et sélections finales)

- Vies simulées : environ 903 millions (hors essais écartés).
- Générations : 56 400 (générale) + 54 000 (personnalisée) ; stratégies différentes explorées : 4 443 088 et 4 532 763.

## 11. Conclusions tirées par l'auteur des simulations

1. Aucune voie sans spéculation n'atteint 10 000 € par mois dans les 5 ans, dans la version personnalisée (0 % des vies).
2. À côté de médecine, avec au plus 10 h par semaine, aucun projet testé n'atteint 10 000 € cumulés en 3, 6 ou 12 mois (au mieux 1,1 % en 12 mois).
3. La voie la plus fiable vers 10 000 € par mois est de garder médecine et de placer l'épargne : 94 % des simulations y arrivent avant 15 ans, vers 29 ans.
4. La licorne n'a aucune chance mesurable dans les voies retenues (0 %). Les meilleures probabilités observées dans les campagnes sont de l'ordre de 0,1 à 0,4 %, sur des parcours startup à plein temps.
5. Hors modèle : les cours en petits groupes et les stages de révision sont le levier de revenu rapide le plus réaliste pour un·e étudiant·e en médecine ; une agence d'automatisation IA pour des cabinets est la voie légale qui combine le mieux revenu rapide et potentiel logiciel, avec des chances faibles à temps partiel.

## 12. Limites à garder en tête

- Modèle, pas réalité : les hypothèses (taux, délais, prix, comportements) sont des choix ; plusieurs cibles de calibrage sont des jugements.
- Revenus bruts (avant impôts et charges) ; probabilités de licorne peu fiables.
- Le modèle ne représente pas les cours en groupe ni la réussite au concours de première année (PASS/LAS).
- Trois défauts majeurs ont été trouvés et corrigés en cours de route (fuite du calibrage des services, queue spéculative, gains de l'ETF comptés comme revenu) ; les résultats antérieurs à ces corrections ne sont pas fiables.
- Code et données brutes : dépôt `pmzf6y5g68-cmd/Aeternum-`, dossier `simulation/` (README, `results/`).
