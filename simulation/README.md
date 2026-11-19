# Simulation de vies : quelle stratégie de revenu pour un jeune sans expérience ?

Ce dossier contient un simulateur de vies (Monte Carlo), un algorithme génétique qui fait évoluer des stratégies de
revenu, une sélection « on coupe, on relance », un calibrage sur des données publiques, et une version personnalisée
pour un·e étudiant·e en médecine de 18 ans, près de Paris, avec 1 500 € d'épargne et quelques bases en code.

> ⚠️ Un modèle n'est pas la réalité. Les résultats sont des **ordres de grandeur conditionnés aux hypothèses**. Les
> probabilités de licorne sont les moins fiables. Les revenus sont avant impôts et charges. Rien ici n'est une promesse.

## En bref

**Pour toi (version personnalisée, contraintes : au plus 10 h par semaine au début, aucun moteur spéculatif).**

- **Aucune voie ne fait 10 000 € par mois dans les cinq premières années** (0 % des simulations).
- **La plus fiable : garder médecine et placer l'épargne en ETF** (rendement moyen de 0,55 % par mois, soit environ 6,8 % par an, hypothèse). Les 10 000 € par mois arrivent vers 29 ans, dans **94 %** des simulations sur 15 ans. Le revenu de médecin fait l'essentiel ; l'ETF complète. Effort : 5 h par semaine au départ.
- **L'alternative : arrêter médecine** (alternance, salariat tech, marque e-commerce) donne **4 300 € par mois à 5 ans** (médiane), mais 10 000 € seulement dans **77 %** des cas sur 15 ans, avec **20 %** d'abandons.
- **Sans limite d'effort, rien ne change** : la même voie reste la meilleure. Travailler plus de 10 h au départ n'accélère rien dans le modèle.
- **Valorisation de plusieurs milliards : pas de chance mesurable** dans ce modèle (licorne : 0 % pour les voies retenues).
- **Spéculation (trading, paris, poker, memecoins) et fraude : exclues.** Dans le modèle, leur espérance est négative et elles produisaient des résultats artificiels (voir Corrections).

**Pour un jeune sans contrainte de médecine** : la meilleure voie sous 10 h atteint 10 000 € par mois dans **53 %** des simulations sur 10 ans (médiane : 1 037 € par mois à 2 ans, 4 057 € à 5 ans).

**Effort de calcul** : environ 900 millions de vies simulées dans les campagnes et sélections finales (110 400 générations
cumulées, 4,4 à 4,5 millions de stratégies différentes explorées par évolution, 12 mondes perturbés pour les finalistes).

## Ce qui est simulé


- **Une vie** : 18 ans → 28 ans (120 mois) pour le modèle général ; 18 → 33 ans (180 mois) pour la version personnalisée.
  Au départ sont tirés au hasard le talent, la ténacité, l'épargne, la chance commerciale et la qualité de l'entreprise.
  En cours de route : chocs de marché, burn-out, associés trouvés ou perdus, levées réussies ou ratées, produit qui
  échoue, clients qui partent.
- **50 moteurs de revenus** (`params.py`), répartis en 16 familles : emploi, services (agence, freelance, closer,
  artisanat…), startups (IA verticale, micro-SaaS, deeptech, défense…), commerce, audience (contenu, newsletter,
  info-produits…), spéculation (trading, paris sportifs, poker, memecoins), placements, et la fraude (témoin).
- **Une stratégie = un génome de 23 gènes** : jusqu'à trois phases parmi les 50 moteurs, leurs déclencheurs, l'activité
  de base (études courtes ou longues, petit job, job à temps plein, rien), les **heures au début** (5, 10, 15 ou 20 h
  par semaine), le seuil de passage à temps plein, le secteur, le canal de vente, le prix, le financement, la
  géographie, l'associé, etc.
- **Version personnalisée** (`model_med.py`) : externat, internat, diplôme, puis revenu de médecin (généraliste ou
  spécialiste), avec ou sans année de césure. Le projet se fait à côté des études ; médecine peut être maintenue ou
  arrêtée si le projet décolle. Charge de travail : 45 h/semaine en premier cycle, 50 h en externat, 55 h en internat.

## Comment les stratégies sont cherchées

1. **Évolution** (`evolve2.py`, `evolve2_med.py`) : 48 îles de 96 stratégies chacune, algorithme génétique multi-objectif
   (type NSGA-II) sur trois critères : vitesse vers 10 k€/mois, probabilité de licorne, part du temps à ≥ 10 k€/mois
   entre 3 et 10 ans. Contrainte : probabilité de catastrophe ≤ 2 %. Migration en anneau toutes les 50 générations.
2. **Destins communs** : à chaque génération, toutes les stratégies vivent les mêmes tirages aléatoires. La comparaison
   est donc équitable, et le bruit de simulation ne fabrique pas de faux gagnants.
3. **Évaluation profonde** : les meilleures trouvées sont réévaluées sur 300 000 vies.
4. **Coupe et relance** (`halving.py`) : sélection par étapes (successive halving). Chaque étape évalue le lot sur un
   budget croissant (20 000, 60 000, puis 200 000 vies par stratégie), **coupe** les moins bonnes (65 à 75 %) et
   **relance** les autres par mutation de un ou deux gènes. Les huit dernières survivantes sont évaluées sur 300 000 vies,
   puis dans des **mondes perturbés** (hypothèses multipliées de ±30 à 50 %). La retenue est celle qui est la plus
   solide en moyenne sur les mondes.
5. **Contrainte d'effort** : pour respecter « pas trop de temps au début », la sélection principale n'autorise que
   5 ou 10 h par semaine pendant la première année. Une sélection sans contrainte sert de comparaison.
6. **Critère de la sélection finale** (dans l'ordre de tes demandes) : la **vitesse** est la probabilité d'avoir atteint
   10 k€/mois pendant 3 mois de suite, pondérée par exp(−t / 36 mois) : une arrivée à 2 ans compte plus qu'une arrivée à
   10 ans. Elle est multipliée par un **facteur de valorisation** de 1 (aucune chance de licorne) à 2 (0,5 % ou plus).
   Les stratégies qui dépassent 2 % de risque de catastrophe sont éliminées.
7. **Moteurs exclus de la recommandation** : trading, paris sportifs, poker, memecoins / NFT et fraude (voir Limites).
8. **En gardant médecine** : une sélection limite l'activité de base à médecine (maintenue, ou avec une année de césure),
   pour comparer directement « garder médecine » et « arrêter médecine ».

**Critère des campagnes d'évolution** (pour les classements de l'algorithme génétique) :
`0,45 × vitesse + 0,30 × licorne (échelle log) + 0,25 × pérennité − 3 × max(0 ; catastrophe − 1 %)`,
où la vitesse vaut 2^(−T/12). Ce critère a montré son défaut quand la contrainte d'effort est active (voir Corrections,
point 23) : il favorise une licorne improbable plutôt que la vitesse ; la sélection finale utilise donc le critère 6.

## Calibrage sur des données publiques

Le premier calibrage (`calibrage_avant_mecanisme.log`) avait révélé que le modèle surestimait la réussite de plusieurs
activités : jusqu'à 25 à 35 % des meilleures versions atteignaient 10 k€/mois pendant 10 ans, contre quelques pour cent
dans les données. Pour chaque activité, un **facteur de difficulté** (colonne `P_CAL`) réduit la demande (clients,
leads, acheteurs, gains) jusqu'à ce que la meilleure version atteigne une **cible de probabilité** (bissection).

- **Cibles sourcées** : créateurs de contenu (4 à 5 % gagnent plus de 100 000 $/an : Aspire 2022, Kajabi 2024 ; 9 % des
  créateurs indépendants : MBO Partners) ; trading (1,1 % des day traders suivis au Brésil gagnent plus
  que le salaire minimum : Chague, De-Losso et Giovannetti, « Day Trading for a Living? ») ; survie des micro-entreprises
  (28 % encore actives à 5 ans, Insee Première n° 2069 ; 22 % des moins de 30 ans encore actifs à 3 ans, cohorte 2018 de l'Insee).
- **Cibles jugées** : les autres. Elles sont signalées comme telles dans `calibrate.py` (bloc `TARGETS`). Ce sont des
  ordres de grandeur, pas des mesures ; le tableau de calibrage du tableau de bord montre les valeurs obtenues.
- **Non calibré** : les taux de levée et de licorne restent ceux des enquêtes CB Insights et Carta (1 à 5,6 % des
  startups qui ont levé un seed deviennent licornes). Ce sont les chiffres les moins fiables du modèle.

## Corrections (failles trouvées par l'algorithme)

L'algorithme exploite les failles d'un modèle. Chacune de celles-ci a été trouvée, puis corrigée avant la campagne finale :

1. Délégation illimitée sans coût de management : capacité plafonnée (25 × (0,5 + ventes) h/mois) ; frais de management
   de 12 % des heures déléguées le mois précédent.
2. Clients récurrents : part de marché plafonnée à 1 % du vivier local.
3. Services facturés à l'heure : grille de prix par palier ; au projet, l'expérience fait gagner du temps, à l'heure non.
4. Coût d'acquisition publicitaire des services : 0,4 × prix + 30 € par lead.
5. Passage d'un service à un produit : les clients récurrents ne suivent que si la stratégie le décide (gène « garder
   les services »), sinon ils sont perdus.
6. Changement de moteur : crédibilité remise à zéro (clients et réputation divisés par deux). La crédibilité B2B ne se
   transporte pas d'un moteur à l'autre.
7. Changement de moteur : l'actif d'audience est vendu, il ne suit pas.
8. Une formation en cours bloque la montée à temps plein.
9. Investisseurs : pas de levée pour un fondateur à temps partiel (probabilité × 0,3).
10. Technologies lourdes sans financement : cycles de vente longs (acquisition × 0,3, croissance organique × 0,5).
11. Entreprise jamais financée : valorisation à 60 % des multiples habituels.
12. Probabilité d'atteindre le produit-marché réduite de 40 % pour les startups.
13. Mortalité du produit : un produit peut échouer (0,8 % par mois avec PMF, 2 % sans) et repart de zéro.
14. Startups non financées : taille de marché et acquisition réduites.
15. Les séances de tutorat n'augmentent plus la compétence technique (compétences de service remappées).
16. Bug de crédibilité : les séances de tutorat comptaient comme clients B2B (corrigé).
17. Médecine à long horizon : 76 % des premiers essais atteignaient 10 k€/mois en 15 ans, par sur-optimisation des
    startups. Corrigé par la mortalité du produit, le PMF réduit, l'amortissement bootstrap et l'acquisition réduite.
18. Charge au-delà de 50 h par semaine : risque de burn-out ; après un épuisement, productivité quasi nulle pendant 2 à 4 mois.
19. Trading : gains réels plus faibles (frais, glissement, erreurs) : facteur de calibrage.
20. Paris sportifs et poker : au-delà d'un seuil de mise, les gains sont réduits (× 0,3), comme des comptes limités.
21. Calibrage : le facteur de difficulté ne couvrait pas tous les leads des services (leads publicitaires et
    recommandations). Corrigé : le facteur porte sur le total des leads.
22. Témoin de fraude : toute stratégie qui la contient est exclue du classement et du tableau de bord.
23. **Critère de valorisation saturé** : le terme licorne du critère d'évolution vaut son maximum dès 1 % de chance,
    si bien qu'une voie sans aucune chance d'atteindre 10 k€/mois en 5 ans obtenait le meilleur score sous la contrainte
    d'effort. Corrigé dans la sélection finale par le critère 6.
24. **Moteurs spéculatifs (non corrigé, exclus)** : la mise porte sur l'épargne accumulée, réinvestie chaque mois ; le
    modèle produit une queue de distribution extrême. Sur la meilleure voie d'une première sélection, 77 % des mois à plus
    de 10 000 € venaient des memecoins, et 71 % des vies atteignaient 10 000 € à un moment donné. Ces moteurs ne sont donc
    pas recommandés ; leurs chiffres ne sont pas publiés.
25. **Revenu de l'ETF** : le gain aléatoire du portefeuille (écart-type 4,5 % par mois) était compté comme revenu, sans
    entrer en trésorerie. Une voie sans aucune activité entrepreneuriale atteignait ainsi 10 000 € par mois dans 89 %
    des vies. Corrigé : seul le rendement moyen (0,55 % par mois) est revenu, versé en trésorerie ; les variations restent
    dans le portefeuille. La voie en tête passe de 89 % à 4,8 % des vies.

## Limites

- **Le modèle n'est pas la réalité.** Les hypothèses (taux, délais, prix, comportements) sont des choix. Les mondes
  perturbés montrent la sensibilité, pas la vérité.
- **Les probabilités de licorne** dépendent de multiples de valorisation et de taux de levée qui ne sont pas calibrés
  sur des données françaises : à prendre comme des ordres de grandeur.
- **Les revenus** sont bruts (avant impôts et charges). En France, le revenu net d'un indépendant est nettement plus bas.
- **L'effort** est modélisé par les heures au début et la charge de travail, pas par le stress ni par la vie sociale.
- **Les données de médecine** (revenus de généraliste et de spécialiste) viennent de la DREES (2021) via des sources
  secondaires ; elles n'ont pas été vérifiées dans le tableau original.
- **Le modèle ne se met pas à jour.** Il faudrait le recalibrer avec les résultats réels d'un test de 90 jours.
- **Moteurs spéculatifs.** Le calibrage ne corrige pas la queue de distribution décrite au point 24 : les moteurs de
  trading, de paris, de poker et de memecoins sont donc exclus de la recommandation, pas seulement mal calibrés.
- **Médecine.** La version personnalisée suppose un parcours type (externat, internat, revenu de médecin après 9 à 11 ans).
  Un·e étudiant·e réel·le peut réorienter, redoubler ou changer de spécialité : le modèle ne le représente pas.

## Résultats détaillés

Tous les chiffres viennent de `results/synthese.md` (généré par `synthese.py`). Pour chaque finaliste, 300 000 vies
simulées ; pour la sélection, 12 mondes perturbés.

**Version personnalisée, 10 h au départ**

| Voie | 10 k€ en 5 ans | 10 k€ en 15 ans | Temps à ≥ 10 k€ (après 3 ans) | Licorne | Abandon | Revenu médian à 5 ans |
|---|---:|---:|---:|---:|---:|---:|
| **Garder médecine + ETF** (retenue) | 0 % | 93,8 % | 29,3 % | 0 % | 15,5 % | 350 € |
| Arrêter médecine : alternance → salariat tech → marque e-commerce | 0 % | 76,7 % | 32,2 % | 0 % | 20,0 % | 4 324 € |
| Référence : médecine seule (sans projet) | 0 % | 93,8 % | 29,3 % | 0 % | 15,4 % | 350 € |

Le premier mois à 10 000 € (série de trois mois) tombe entre le 133ᵉ et le 137ᵉ mois dans la voie retenue, soit vers 29 ans.
Le revenu de médecin généraliste (8 000 € bruts) dépasse 10 000 € grâce au rendement de l'épargne placée ; le spécialiste
(12 000 € bruts) l'atteint directement.

**Version générale, 10 h au départ (horizon 10 ans)**

| Voie | 10 k€ en 10 ans | Temps à ≥ 10 k€ (après 3 ans) | Licorne | Abandon | Revenu médian à 2 ans | Revenu médian à 5 ans |
|---|---:|---:|---:|---:|---:|---:|
| Alternance → salariat tech → marque e-commerce | 53,1 % | 15,1 % | 0 % | 14,0 % | 1 037 € | 4 057 € |

**Calibrage** : 21 activités calées sur leur cible (écart de quelques dixièmes de point) ; les cibles sont signalées comme
sourcées ou comme jugements dans `calibrate.py`. Tableau complet dans `results/calibrage.json` et sur le tableau de bord.

## Ce que le modèle ne dit pas

- Il ne dit pas que 10 000 € par mois est un objectif réaliste à 18 ans : dans le modèle, il est atteint par le revenu de
  médecin, après une dizaine d'années.
- Le rendement de l'ETF (6,8 % par an) est une hypothèse, versée en revenu. Si le rendement réel est plus bas, le
  résultat de la voie retenue baisse fortement.
- Les revenus sont bruts. Un salaire de médecin de 8 000 € bruts donne un net nettement plus bas.
- Aucune recommandation d'investissement : le modèle compare des hypothèses, pas des placements réels.

## Historique et essais écartés

Les résultats des essais précédents sont archivés localement (suffixes `avant_calibrage`, `avant_correctif`,
`avant_exclusion`, `avant_correctif_etf`, ignorés par git). Ils ne sont pas à utiliser : chacun a été écarté après
la correction d'un défaut décrit plus haut.

## Reproduire

```bash
cd simulation
python3 calibrate.py 200            # calibrage des facteurs par activité (≈ 8 min, 4 cœurs)
./run_final2.sh                     # campagnes, sélections, exports et variantes (≈ 1 h)
python3 synthese.py                 # results/synthese.md
```

Les fichiers de résultats volumineux ne sont pas versionnés. Les jeux de données du tableau de bord sont dans
`results/dash_v2/` et publiés sur l'artefact.


Les fichiers de résultats sont dans `results/` (certains ne sont pas versionnés) ; les jeux de données du tableau de bord
sont dans `results/dash_v2/` et publiés dans `dashboard/`.
