# Simulation générationnelle : comment devenir riche en partant de zéro

Ce dossier contient un **algorithme génétique** qui fait évoluer des stratégies d'enrichissement pour une personne
**seule, jeune, sans expérience ni réseau, en France, avec environ 1 500 € d'épargne**. Il cherche la stratégie qui :

1. atteint **10 000 €/mois** le plus vite possible ;
2. reste **pérenne**, c'est-à-dire qu'elle rapporte encore ≥ 10 k€/mois à 5 ans ;
3. garde un **potentiel de valorisation ≥ 1 milliard de dollars**.

> ⚠️ Le modèle n'est pas la réalité. L'algorithme optimise *à l'intérieur* d'hypothèses que j'ai écrites et calées sur des
> données publiques (voir plus bas). C'est pour ça que tout est relancé dans 24 « mondes » où ces hypothèses sont
> perturbées de ±30 à 50 %. Les résultats donnent des **ordres de grandeur et un classement**, pas des promesses.

## Comment ça marche

**Une vie simulée** (`model.py`) avance mois par mois pendant 10 ans. Chaque vie tire au hasard un talent, une
ténacité, un capital de départ, la chance commerciale et les chocs de marché. Les compétences (technique, vente,
connaissance d'un métier, contenu), l'audience, le réseau, la trésorerie, la fatigue (burnout) et la motivation
(abandon) évoluent. Le modèle suit aussi les clients, le revenu récurrent, les levées de fonds (accélérateur, seed,
séries A à D), la dilution, la valorisation, et la saisie des gains illicites.

**Une stratégie** est un génome de 20 gènes :

- jusqu'à **3 phases** parmi 15 moteurs de revenus : salariat, freelance, agence d'automatisation IA, closer,
  micro-SaaS, startup IA verticale, app B2C, marketplace, fintech, deeptech, e-commerce, contenu, info-produits,
  trading et fraude (témoin) ;
- les **déclencheurs** de passage d'une phase à l'autre : un seuil de revenu tenu 3 mois et/ou un délai ;
- le secteur visé (14 au choix), le canal d'acquisition, le niveau de prix, les heures par semaine, le temps
  d'apprentissage, la part de temps sur le contenu, le réinvestissement ;
- le mode de financement et son déclencheur, la stratégie géographique, la recherche d'un associé, le positionnement
  niche ou large, et le choix de garder l'agence pour financer le produit.

**L'évolution** (`evolve.py`) suit l'algorithme NSGA-II, multi-objectif et élitiste. À chaque génération :

1. on tire de nouveaux destins aléatoires ;
2. les enfants naissent par tournoi, croisement et mutation ;
3. chaque stratégie vit les *mêmes* destins (nombres aléatoires communs, pour des comparaisons justes) ;
4. on garde les stratégies non dominées sur les 3 objectifs, les autres meurent.

Il existe une contrainte : pas plus de 2 % de risque de catastrophe judiciaire.

Un cache cumule les vies déjà simulées des stratégies survivantes. Plus une stratégie survit, plus son score est
précis : jusqu'à 2 048 vies pendant l'évolution. Les finalistes sont ensuite réévalués sur 200 000 vies chacun.

## Résultats de la campagne (19 novembre 2026)

**1 369 820 080 vies simulées** (environ 164 milliards de mois de vie), **21 100 générations**, **2 011 135 stratégies
uniques** testées : 3 évolutions principales, 15 évolutions « une voie à la fois » et 24 mondes perturbés.

### La stratégie gagnante

Les évolutions 1 et 2 sont parties de populations aléatoires différentes et ont trouvé **la même recette** :

1. **Closer** (vente à la commission) jusqu'à 4 k€/mois tenus 3 mois, 12 mois au maximum : on apprend à vendre en
   étant payé.
2. **Agence d'automatisation IA** pour un seul métier (l'immobilier dans le modèle), avec ces réglages :
   - prospection directe, prix moyen, 55 h/semaine ;
   - un associé dès que possible, des clients au-delà de la France, une niche étroite ;
   - sous-traiter dès que la demande dépasse sa capacité.
3. **Startup IA verticale** pour ce même métier, au plus tard après 48 mois d'agence. L'agence est gardée pour financer
   le produit, et on lève des fonds vers 1,5 M€ de revenu annuel récurrent.

Résultats sur 200 000 vies :

| Indicateur | Valeur |
|---|---|
| 10 k€/mois atteints en 12 mois | 0,5 % des vies |
| 10 k€/mois atteints en 24 mois | 12,5 % des vies |
| 10 k€/mois atteints en 5 ans | 39 % des vies |
| ≥ 10 k€/mois à 5 ans | 36 % des vies |
| Temps passé à ≥ 10 k€/mois entre 3 et 10 ans | 26 % en moyenne |
| Potentiel licorne | 1,2 %, soit environ 1 chance sur 80 |
| Abandon en route | 47 % |

Pour comparaison, une startup IA lancée directement par un débutant n'a que 0,01 % de potentiel licorne.

L'évolution 3 optimisait une pérennité plus stricte. Elle a trouvé « 2 ans de salariat puis startup IA » : même
potentiel licorne, mais 0 % de chances d'atteindre 10 k€ en 2 ans.

### Ce que la sélection élimine (meilleure version de chaque voie)

| Voie | 10 k€ en 24 mois | ≥ 10 k€ à 5 ans | Potentiel licorne | Abandon ou ruine |
|---|---|---|---|---|
| Agence IA seule | 17 % | 34 % | 0 | 53 % |
| Info-produits | 4,4 % | 27 % | 0 | 55 % |
| Freelance | ≈ 0 | 19 % | 0 | 63 % |
| Closer seul | 6 % | 15 % | 0 | 43 % |
| Contenu | 0,5 % | 8 % | 0 | 74 % |
| Trading | 2 % | 0,3 % | 0 | 93 % |
| E-commerce, micro-SaaS, app B2C, marketplace, fintech, deeptech en direct | < 0,5 % | < 1,5 % | ≤ 0,01 % | ≥ 95 % |
| Fraude (témoin) | 5,7 % (gains non saisis) | 0,3 % | 0 | **91 % condamnés** |

### Robuste aux erreurs d'hypothèses (24 mondes perturbés)

- Le parcours gagnant finit par une **entreprise de produit IA** dans 24 mondes sur 24, dont 20 fois une startup IA
  verticale.
- La meilleure stratégie travaille **55 h/semaine** dans 23 mondes sur 24.
- Elle a **un associé** et vend **au-delà de la France** dans 24 mondes sur 24.
- La première étape varie selon les hypothèses : vente (closer) 9 fois, contenu ou info-produits 10 fois,
  salariat 3 fois, agence 2 fois.

### Ce qui compte le plus (un seul réglage changé, 100 000 vies chacun)

Effet mesuré sur la part du temps passée à ≥ 10 k€/mois entre la 3ᵉ et la 10ᵉ année (référence : 26 %).

- **Canal** : publicité au lieu de la prospection directe, −22 points ; contenu, −19.
- **Secteur** : santé au lieu de l'immobilier, −19 points ; juridique, −11. Les ressources humaines ne font que −2.
- **90 h/semaine au lieu de 55** : −18 points et 86 % d'abandon (burnout).
- **Prix bas** : −17 points.
- **France uniquement** : −13 points, et un potentiel licorne divisé par 5.
- **Marché large au lieu d'une niche** : −11 points.
- **Supprimer la phase closer** : −7 points.
- **Sans associé** : −4 points, et un potentiel licorne divisé par 2,4.
- **Rester une agence sans jamais lancer la startup** : +4 points de revenu stable, mais un potentiel licorne nul.
  C'est le vrai arbitrage : la startup coûte un peu de revenu contre environ 1 % de chance de licorne.

## Lancer

```bash
pip install numpy numba
python3 calibrate.py 20000      # chaque moteur seul, réglages « raisonnables »
python3 evolve.py main --pop 500 --gens 2000 --M 256 --seed 3 --dur2   # évolution « pérennité stricte »
python3 variants.py "[3, 2, 5, 2, 3, 0, 7, 3, 0, 1, 1, 2, 1, 1, 3, 3, 3, 2, 0, 1]" 100000  # analyse « et si »
python3 trajectory.py '[["Stratégie gagnante", [3, 2, 5, 2, 3, 0, 7, 3, 0, 1, 1, 2, 1, 1, 3, 3, 3, 2, 0, 1]]]' 5000
./run_all.sh                    # campagne complète (~1 h sur 4 cœurs)
python3 export.py               # jeux de données du tableau de bord (results/dash/)
python3 trace.py "[3, 2, 5, 2, 3, 0, 7, 3, 0, 1, 1, 2, 1, 1, 3, 3, 3, 2, 0, 1]" 3   # 3 vies mois par mois
python3 funnel.py "[...génome...]" 5000   # entonnoir des levées de fonds
```

## Calage sur des données réelles

| Ce que le modèle reproduit | Valeur visée | Source |
|---|---|---|
| Part des startups ayant levé un seed qui deviennent licornes | 1 % (moyenne) à 5,6 % (quartile haut) | CB Insights ; Carta *State of the Seed* 2025 ; Y Combinator ≈ 4,5 % sur les promotions matures |
| Passage seed → série A → B → C | ≈ 45 % → 55 % → 45 % | ordres de grandeur Carta / CB Insights |
| Multiples de valorisation IA | 10–50× l'ARR, 50–100× pour les leaders (Harvey, Sierra) | Tomasz Tunguz 2026 ; guides de valorisation IA 2026 |
| Tarifs d'une agence d'automatisation IA (PME) | mise en place 1,5–8 k$, abonnement 500–3 000 $/mois | guides de prix 2026 (Ciela, taskip…) |
| Traders particuliers | ~97 % de perdants parmi ceux qui persistent | Chague, De-Losso & Giovannetti (2019), Brésil ; avertissements AMF/ESMA sur les CFD |
| Productivité au-delà de 50 h/semaine | quasi nulle | Pencavel (2014) |

## Failles trouvées par l'algorithme (et corrigées)

Un algorithme génétique exploite la moindre erreur d'un modèle. Pendant le calage et la campagne, il a trouvé et exploité :

- le **tarif premium** qui ne freinait pas le bouche-à-oreille : une PME à 3 600 €/mois devenait une machine à milliards ;
- l'**audience des réseaux sociaux** convertie en clients B2B chers sans tenir compte du prix ni de sa pertinence ;
- la **prospection à froid** illimitée sur le même vivier d'entreprises ;
- le **freelance premium international** à 1 200 €/jour après 3 ans ;
- les **90 h/semaine** sans perte de productivité ;
- la **pérennité** mesurée sur une seule fenêtre (mois 55 à 60) : l'algorithme lançait la startup juste après ;
- l'**abandon** qui faisait échapper à la justice après une fraude (bug corrigé, voie relancée) ;
- la **publicité** au coût d'acquisition constant à 2 M€/mois ;
- les **levées de fonds** qui rendaient la licorne presque automatique ;
- des **créateurs de contenu** qui grossissaient tous au même rythme.

Chaque correction s'appuie sur un mécanisme réel : élasticité-prix, épuisement du vivier, rendements décroissants,
sélection et échecs après levée, talent à queue lourde.

## Le moteur « fraude »

Il est là comme **témoin**, parce que la demande était « sans limite morale ». Ses paramètres sont illustratifs :
détection d'environ 3 % par mois, saisie des gains, prison. Il sert à montrer que la sélection l'élimine. Je n'aide pas à
le mettre en œuvre, et rien dans ce dépôt ne le décrit concrètement.

## Limites

- Tout dépend des hypothèses de `params.py` et `model.py`. Les mondes perturbés testent leur sensibilité, pas leur vérité.
- Le « potentiel licorne » est une probabilité modélisée, fondée sur la valorisation à 10 ans plus 2 ans de croissance
  extrapolée. Les queues de distribution sont les moins fiables.
- Le revenu est un bénéfice mensuel avant impôts et charges sociales. En France, comptez 25 à 45 % de prélèvements.
- Le modèle ignore la vie personnelle, la santé (hors burnout), les crises macroéconomiques et les ruptures
  technologiques autres que les chocs modélisés.
