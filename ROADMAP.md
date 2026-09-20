# Roadmap — idées d'ajouts

Chaque idée est notée sur **Utilité** (ce que ça apporte à un joueur qui veut faire des coins vite et sans se faire piéger) et **Difficulté** (travail + risques techniques), de 1 à 5. Le **rapport U/D** aide à choisir : plus il est haut, plus c'est rentable à développer. Les efforts sont des ordres de grandeur.

Les faits techniques cités ont été **vérifiés** (endpoints testés, versions consultées, volumes mesurés). Quand une donnée manque, c'est écrit.

## Déjà fait

Flips PNJ (achat Bazaar → revente PNJ) · profils de risque · export / import · favoris avec mini-courbes · suivi des ordres et du profit réel · calendrier SkyBlock, Jacob's Contest et mesure de l'effet des événements · historique et meilleures heures · refonte visuelle et charte graphique (`brand.html`).

## Tableau récapitulatif

Trié par rapport U/D décroissant, puis par utilité. « Ancien n° » renvoie à la liste précédente.

| ID | Idée | Utilité | Difficulté | U/D | Effort | Dépendance / risque principal |
|---|------|:------:|:---------:|:---:|:------:|-------------------------------|
| 1 | Précision des estimations sur tes propres flips | 4 | 2 | **2,0** | ~3 h | Il faut quelques flips terminés pour que ce soit parlant |
| 2 | Tests automatiques du moteur + CI (ancien 5) | 4 | 2 | **2,0** | ~6 h | Extraire le JS de `index.html` |
| 3 | Mise à jour des actions GitHub | 2 | 1 | **2,0** | ~30 min | Versions majeures : tester via un déclenchement manuel |
| 4 | Simulateur d'objectif (ancien 3) | 2 | 1 | **2,0** | ~1 h | Ordre de grandeur seulement |
| 5 | Statut des sources de données | 2 | 1 | **2,0** | ~1 h | Aucune |
| 6 | Accessibilité clavier et lecteurs d'écran | 3 | 2 | **1,5** | ~4 h | Aucune |
| 7 | Alertes Jacob par culture | 3 | 2 | **1,5** | ~3 h | Notifications seulement si la page reste ouverte |
| 8 | Précalcul nocturne : événements + historiques (ancien 7) | 4 | 3 | **1,3** | ~7 h | Limite de requêtes Coflnet (429) |
| 9 | Détection de manipulation avancée (ancien 6) | 4 | 3 | **1,3** | ~5 h | Seuils à calibrer, faux positifs |
| 10 | Flips PNJ inverse (acheter au PNJ, revendre au Bazaar) | 4 | 3 | **1,3** | ~6 h | Données de boutiques éparpillées, limites d'achat non confirmées |
| 11 | Journal et backtest complets (ancien 8) | 5 | 4 | **1,25** | ~10 h | Il faut accumuler des données dans le temps |
| 12 | Flips de craft (ancien 9) | 5 | 4 | **1,25** | ~12 h | Recettes imbriquées, temps de craft |
| 13 | Cultures du Jacob's Contest → items liés (ancien 10) | 3 | 3 | 1,0 | ~4 h | Effet sur les prix non mesurable |
| 14 | Graphiques du profit réalisé (ancien 11) | 2 | 2 | 1,0 | ~3 h | Aucune |
| 15 | PWA installable (ancien 12) | 2 | 2 | 1,0 | ~3 h | Service worker à maintenir |
| 16 | Version anglaise (ancien 18) | 2 | 2 | 1,0 | ~4 h | Textes en dur dans le HTML et le JS |
| 17 | Volume réel par heure de la journée (ancien 15) | 4 | 5 | 0,8 | ~15 h | Aucune source publique |
| 18 | Flips de l'Auction House (ancien 16) | 4 | 5 | 0,8 | 20 h + | Données énormes, marché très concurrentiel |
| 19 | Effet des perks du maire (ancien 13) | 3 | 4 | 0,75 | ~8 h | Pas d'historique fiable des maires |
| 20 | Alertes Discord / Telegram (ancien 14) | 3 | 4 | 0,75 | ~8 h | Cron GitHub imprécis, secrets par utilisateur |

## Détail des idées

### 1. Précision des estimations sur tes propres flips — U4 · D2
Le suivi enregistre déjà les dates de création, d'achat et de vente ainsi que les prix réels. Il manque les **prévisions au moment du suivi** (durée d'achat, durée de vente, profit). En les stockant, la page peut afficher : « tes achats prennent en moyenne 1,6× plus longtemps que prévu » et **proposer une valeur réaliste pour la « part de marché captée »**. C'est la version légère du backtest (idée 11) : elle utilise tes vrais flips, sans collecte de fond. **Limite** : peu parlant tant que tu n'as pas terminé quelques flips.

### 2. Tests automatiques + CI — U4 · D2
Le cœur du produit (risque, durées, profit, mesure des événements, flips PNJ, validation des imports) n'a **aucun test**. Or ce code a beaucoup grossi, et la validation d'import est devenue critique côté sécurité. Une régression silencieuse fausserait les conseils sans que personne ne la voie. Il faut extraire ces fonctions dans un module et les tester (Node) à chaque push. Pas de gain visible, mais tout le reste devient plus sûr. J'ai relevé U de 3 à 4 pour cette raison.

### 3. Mise à jour des actions GitHub — U2 · D1
Vérifié : le workflow utilise `checkout` v4, `configure-pages` v5, `upload-pages-artifact` v3 et `deploy-pages` v4, alors que les dernières versions sont respectivement v7, v6, v5 et v5. GitHub a déjà affiché un avertissement (Node 20 déprécié) et annonce le passage de `ubuntu-latest` à Ubuntu 26 à partir du 19 octobre 2026. Tant que ça tourne, rien ne casse, mais un déploiement qui échoue silencieusement un jour est le genre de panne qu'on découvre trop tard.

### 4. Simulateur d'objectif — U2 · D1
« Avec 5M et 2M/h, combien de temps pour 100M ? », avec et sans réinvestissement. Utile pour motiver, très simple, mais à présenter comme un ordre de grandeur : le profit/h réel baisse quand le capital grossit.

### 5. Statut des sources de données — U2 · D1
La page dépend de cinq sources (Hypixel, Coflnet, skyblock.bz, planning Jacob, prix PNJ). Des erreurs ont déjà été observées (limite 429 de Coflnet, sources sans CORS). Un petit indicateur « tout est à jour / historique indisponible » avec l'heure de dernière réussite éviterait de se demander pourquoi une fiche n'a pas de courbe.

### 6. Accessibilité clavier et lecteurs d'écran — U3 · D2
Les lignes des tableaux ne s'ouvrent **qu'à la souris** : elles ne sont ni focalisables ni activables au clavier. À faire : lignes focalisables (Entrée pour ouvrir la fiche), piégeage du focus dans le panneau latéral, `prefers-reduced-motion`, libellés pour les lecteurs d'écran. Les contrastes du texte ont déjà été choisis pour tenir 5:1. (L'ancien « thème clair » est abandonné : il contredirait la direction artistique.)

### 7. Alertes Jacob par culture — U3 · D2
Le planning des 76 prochains concours avec leurs 3 cultures est déjà chargé. Tu choisis les cultures que tu farmes, et la page te prévient (notification navigateur) quand un concours qui les contient démarre. **Limite** : seulement pendant que la page est ouverte.

### 8. Précalcul nocturne : événements + historiques — U4 · D3
Le moteur de mesure des effets d'événements ne tourne aujourd'hui que sur les items ouverts, et l'historique vient de Coflnet qui répond 429 en cas de rafale. Un workflow nocturne pourrait le lancer sur les ~200 items les plus liquides et publier un JSON servi avec le site : onglet « Opportunités d'événement » et moins de dépendance à Coflnet côté navigateur. **Limite** : il faut espacer ~200 requêtes lentes.

### 9. Détection de manipulation avancée — U4 · D3
Aujourd'hui : marge anormale et écart entre le haut du carnet et la moyenne pondérée. On dispose en plus de tout le carnet (`sell_summary` / `buy_summary`) : détecter un **mur** (énorme quantité qui bloque), un ordre isolé loin des suivants, une profondeur qui disparaît. Cas réel à calibrer : **Rusty Coin** (achat 36k, vente 66k, 2 420 échanges/h) est signalé « Élevé » (62) mais ressort quand même en tête du profil Agressif à 13,5M/h. **Risque** : faux positifs qui masqueraient de vrais bons flips.

### 10. Flips PNJ inverse — U4 · D3
Acheter chez un PNJ, revendre au Bazaar. Vérifié : le dépôt NotEnoughUpdates (CORS ouvert) contient **134 fichiers PNJ avec des boutiques** ; les données existent donc, mais éparpillées, avec un format à parser. Difficultés : coûts non triviaux (monnaies autres que les coins), stocks ou limites d'achat que je n'ai **pas pu confirmer** (une limite de 640 items/jour est citée par une source sans confirmation ailleurs). À traiter comme le flip PNJ actuel : signaler clairement ce qui n'est pas vérifié.

### 11. Journal et backtest complets — U5 · D4
Le plus gros inconnu du modèle : la **part de marché réellement captée** (20 % par défaut) et les durées. Enregistrer chaque recommandation, ses prix, puis comparer 1 h plus tard avec ce qui s'est passé. L'idée 1 en est la version légère ; celle-ci suppose une collecte dans le temps (au début, uniquement quand la page est ouverte).

### 12. Flips de craft — U5 · D4
Acheter les ingrédients, crafter, revendre : c'est l'un des flips les plus rentables et skyblock.bz en fait une section entière. Le dépôt NotEnoughUpdates expose les recettes avec CORS ouvert. Difficultés : recettes imbriquées (acheter le composant fini n'est pas toujours mieux), temps de craft, quantités par craft, formats qui changent.

### 13. Cultures du Jacob's Contest → items liés — U3 · D3
Relier chaque culture à ses items du Bazaar (mapping manuel, ~13 cultures). **Mais** : un concours par heure, donc effet sur les prix impossible à isoler avec l'historique disponible : ce serait du contexte, pas un signal mesuré.

### 14. Graphiques du profit réalisé — U2 · D2
Courbe du profit cumulé, taux de réussite, meilleur et pire flip. Sympa, sans impact sur les décisions.

### 15. PWA — U2 · D2
Installable sur téléphone, ouverture instantanée. Le contenu dépend de données en direct, le hors-ligne n'apporte donc presque rien.

### 16. Version anglaise — U2 · D2
Le texte est en dur dans le HTML et dans le JS ; à faire proprement, il faut d'abord extraire les chaînes.

### 17. Volume réel par heure de la journée — U4 · D5
Ce qu'on aimerait vraiment pour les « pics d'achat » : le nombre d'achats et de ventes instantanés **par heure**. Aucune source publique ne le donne. Il faudrait le construire en enregistrant des instantanés du Bazaar pendant des semaines : long et fragile (cron, stockage), mais ce serait un vrai avantage.

### 18. Flips de l'Auction House — U4 · D5
Marché énorme, volumineux et très concurrentiel (outils spécialisés, bots). Hors de portée d'une page statique honnêtement utile.

### 19. Perks du maire — U3 · D4
Le maire actuel est affiché, mais mesurer un effet demande l'**historique des maires** (dates et identité), que je n'ai pas trouvé dans une source unique et fiable. Sans ça, toute affirmation serait une supposition.

### 20. Alertes Discord / Telegram — U3 · D4
Prévenir même page fermée. Un cron GitHub Actions est **imprécis** (retards de plusieurs minutes, minimum 5 min) et un webhook est un secret : chaque utilisateur devrait déployer sa propre copie. Les notifications navigateur, déjà présentes, couvrent le cas « page ouverte en arrière-plan ».

## Ce que je déconseille
- **Lire ses vrais ordres Bazaar via l'API Hypixel** : elle n'expose pas les ordres en cours, et une clé d'API ne peut pas être cachée dans une page statique.
- **Automatiser des ordres en jeu** : contre les règles du serveur et hors du rôle de cet outil.
- **Filtrer les items « bizarres »** (Fake Shuriken, Rusty Coin…) : ce sont de vrais items échangés ; le bon traitement est le score de risque, à affiner (idée 9), pas une liste noire.

## Ordre conseillé
1. **Fondations** : 3 (actions, 30 min) puis 2 (tests).
2. **Rendre les chiffres vrais** : 1 (précision sur tes flips), puis 9 (manipulation).
3. **Nouvelle source de gains** : 10 (PNJ inverse), puis 12 (craft).
4. **À la demande** : 5, 6, 7, 8, 4, 11.
