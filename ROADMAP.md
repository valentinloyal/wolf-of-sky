# 🗺️ Roadmap — idées d'ajouts

Chaque idée est notée sur **Utilité** (ce que ça apporte à un joueur qui veut faire des coins vite et sans se faire piéger) et **Difficulté** (travail + risques techniques), de 1 à 5. Le **rapport U/D** aide à choisir : plus il est haut, plus c'est rentable à développer.

Le tableau est **trié par rapport U/D décroissant** ; les numéros (ID) renvoient aux détails plus bas.

Les faits techniques cités ont été **vérifiés** (endpoints testés, CORS, volumes de données). Les estimations d'effort sont des ordres de grandeur.

## Tableau récapitulatif

| ID | Idée | Utilité | Difficulté | U/D | Effort | Dépendance / risque principal |
|---|------|:------:|:---------:|:---:|:------:|-------------------------------|
| 1 | ✅ **Fait** — Profils « Prudent / Équilibré / Agressif » | 3 | 1 | **3,0** | ~1 h | Aucune |
| 2 | ✅ **Fait** — Flips Bazaar → NPC (revente au PNJ) | 4 | 2 | **2,0** | ~3 h | Fichier items Hypixel de 5 Mo → à pré-filtrer |
| 3 | Simulateur d'objectif / intérêts composés | 2 | 1 | **2,0** | ~1 h | Aucune |
| 4 | ✅ **Fait** — Export / import du suivi et des favoris | 3 | 2 | **1,5** | ~3 h | Aucune |
| 5 | Tests automatiques du moteur de calcul + CI | 3 | 2 | **1,5** | ~6 h | Extraire le JS de `index.html` |
| 6 | Détection de manipulation avancée (murs, ordres isolés) | 4 | 3 | **1,3** | ~5 h | Seuils à calibrer, faux positifs |
| 7 | Scan des effets d'événements sur tous les items (précalculé) | 4 | 3 | **1,3** | ~6 h | Limite de requêtes Coflnet (429) |
| 8 | Journal & backtest des recommandations | 5 | 4 | **1,25** | ~10 h | Il faut accumuler des données dans le temps |
| 9 | Flips de craft (Bazaar → craft → Bazaar) | 5 | 4 | **1,25** | ~12 h | Recettes (dépôt NEU), sous-composants, temps de craft |
| 10 | Cultures du Jacob's Contest → items liés | 3 | 3 | 1,0 | ~4 h | Effet sur les prix non mesurable (voir détail) |
| 11 | Graphiques du profit réalisé + statistiques | 2 | 2 | 1,0 | ~3 h | Aucune |
| 12 | PWA installable + hors-ligne | 2 | 2 | 1,0 | ~3 h | Service worker à maintenir |
| 17 | Thème clair + accessibilité (clavier, contrastes) | 2 | 2 | 1,0 | ~4 h | Aucune |
| 18 | Version anglaise | 2 | 2 | 1,0 | ~4 h | Tout le texte est en dur dans le HTML |
| 15 | Volume réel par heure de la journée (collecte propre) | 4 | 5 | 0,8 | ~15 h | Pas de source publique ; stockage + fiabilité du cron |
| 16 | Flips de l'Auction House (BIN) | 4 | 5 | 0,8 | 20 h + | Données énormes, marché très concurrentiel |
| 13 | Effet des perks du maire sur les prix | 3 | 4 | 0,75 | ~8 h | Historique des maires introuvable en source unique |
| 14 | Alertes hors-page (Discord / Telegram) | 3 | 4 | 0,75 | ~8 h | Cron GitHub imprécis, secrets par utilisateur |

## Détail des idées

### 1. Profils de risque — U3 · D1 — ✅ fait
Trois boutons qui règlent d'un coup le risque max, la part de marché captée, la durée de cycle et le volume minimum. Idéal pour un débutant qui ne veut pas comprendre 5 réglages. Très peu de code : ces réglages existent déjà.

### 2. Flips Bazaar → NPC — U4 · D2 — ✅ fait
Acheter au Bazaar, revendre au PNJ à prix fixe : **quasiment sans risque** et sans attente de vente. Vérifié : l'API Hypixel `resources/skyblock/items` (CORS ouvert) donne `npc_sell_price` pour **2 352 items**, dont 766 présents au Bazaar, et **71 dont la revente PNJ dépasse le prix d'achat instantané**. Beaucoup sont anecdotiques (items à quelques coins), il faudra un filtre de gain minimal. Le fichier fait 5 Mo : un workflow GitHub Actions peut le réduire à un petit JSON.

### 3. Simulateur d'objectif — U2 · D1
« Avec 5M et 2M/h, combien de temps pour 100M ? », avec et sans réinvestissement. Utile pour motiver, très simple, mais à présenter comme un ordre de grandeur (le profit/h réel baisse quand le capital grossit, le marché ne suit pas).

### 4. Export / import — U3 · D2 — ✅ fait
Sauvegarder favoris et suivi dans un fichier ou un texte à copier, pour changer d'appareil ou de navigateur. Aujourd'hui tout est dans le `localStorage` : vider le navigateur efface tout.

### 5. Tests automatiques + CI — U3 · D2
Le cœur du produit (risque, durées, profit, mesure des événements) n'a aucun test : une régression silencieuse fausserait les conseils sans que personne ne le voie. Extraire ces fonctions dans un module et les tester (Node) à chaque push. Pas de gain visible, mais c'est ce qui rend les autres ajouts plus sûrs.

### 6. Détection de manipulation avancée — U4 · D3
Aujourd'hui : marge anormale et écart entre le haut du carnet et la moyenne pondérée. On a en plus tout le carnet (`sell_summary`/`buy_summary`) : détecter un **mur** (énorme quantité qui bloque), un ordre isolé loin des suivants, une profondeur qui disparaît. Risque : faux positifs qui masqueraient de vrais bons flips, à calibrer sur des cas réels.

### 7. Scan des effets d'événements sur tous les items — U4 · D3
Le moteur de mesure existe déjà (Spooky Festival, Jerry…) mais ne tourne que sur les items ouverts. Un workflow nocturne pourrait le lancer sur les ~200 items les plus liquides et publier un JSON : onglet « Opportunités d'événement » (« ces items montent de X % le jour J »). **Limite** : Coflnet répond 429 en cas de rafale ; il faut espacer (≈ 200 requêtes lentes).

### 8. Journal & backtest — U5 · D4
Le plus gros inconnu du modèle : la **part du marché réellement captée** (20 % par défaut) et les durées estimées. Enregistrer chaque recommandation, ses prix, puis comparer 1 h plus tard avec ce qui s'est passé → calibrer ces paramètres avec des données réelles au lieu d'hypothèses. Dépend d'une collecte dans le temps (au début : uniquement quand la page est ouverte).

### 9. Flips de craft — U5 · D4
Acheter les ingrédients, crafter, revendre : c'est l'un des flips les plus rentables et skyblock.bz en fait une section entière. Vérifié : le dépôt NotEnoughUpdates expose les recettes avec CORS ouvert. Difficultés : recettes imbriquées (le meilleur choix n'est pas toujours d'acheter le composant fini), temps de craft, quantités par craft, formats de recettes qui changent.

### 10. Cultures du Jacob's Contest → items liés — U3 · D3
Les cultures du concours sont désormais affichées. On pourrait relier chaque culture à ses items du Bazaar (mapping à faire à la main, ~13 cultures). **Mais** : il y a un concours par heure, donc impossible d'isoler leur effet sur les prix avec l'historique disponible ; ce serait du contexte, pas un signal mesuré. D'où U3 seulement.

### 11. Statistiques du profit réalisé — U2 · D2
Courbe du profit cumulé, taux de réussite, meilleur / pire flip. Sympa, sans impact sur les décisions.

### 12. PWA — U2 · D2
Installable sur téléphone, ouverture instantanée. Le contenu dépend de données en direct, le hors-ligne n'apporte donc presque rien.

### 13. Perks du maire — U3 · D4
Certains maires font bouger des prix (Diana → items de mythologie, etc.). Le maire actuel est affiché, mais mesurer un effet demande l'**historique des maires** (dates + identité), que je n'ai pas trouvé dans une source unique et fiable. Sans ça, toute affirmation serait une supposition.

### 14. Alertes Discord / Telegram — U3 · D4
Prévenir quand un favori devient rentable même page fermée. Un cron GitHub Actions est **imprécis** (retards de plusieurs minutes, minimum 5 min) et un webhook est un secret : chaque utilisateur devrait déployer sa propre copie. Les notifications navigateur (déjà là) couvrent le cas « page ouverte en arrière-plan ».

### 15. Volume réel par heure — U4 · D5
Ce qu'on aimerait vraiment pour les « pics d'achat » : le nombre d'achats/ventes instantanés **par heure de la journée**. Aucune source publique ne le donne. Il faudrait le construire soi-même en enregistrant des instantanés du Bazaar toutes les quelques minutes pendant des semaines. Long à mettre en place et fragile (cron, stockage), mais ce serait un vrai avantage.

### 16. Flips de l'Auction House — U4 · D5
Marché énorme, mais volumineux et très concurrentiel (des outils spécialisés, des bots). Hors de portée d'une page statique honnêtement utile.

### 17. Thème clair + accessibilité — U2 · D2
Navigation au clavier, contrastes, lecteurs d'écran. Utile pour la qualité, peu pour le gain de coins.

### 18. Version anglaise — U2 · D2
Le texte est en dur dans le HTML ; à faire proprement il faut d'abord extraire les chaînes.

## Ce que je déconseille
- **Lire ses vrais ordres Bazaar via l'API Hypixel** : l'API publique n'expose pas les ordres en cours et une clé API ne peut pas être cachée dans une page statique.
- **Automatiser des ordres en jeu** : contre les règles du serveur et hors du rôle de cet outil.

## Ordre conseillé
1. **Gains rapides** : #1 profils, #2 flips NPC, #4 export/import.
2. **Fiabilité** : #5 tests, puis #6 manipulation.
3. **Valeur maximale** : #9 craft (le plus attendu), #8 backtest (pour rendre les estimations vraies).
4. **À la demande** : #7, #10, #13, #14, #15.
