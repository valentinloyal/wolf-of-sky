# 🐺 Wolf of Sky — Bazaar Flipper

Outil pour trouver les meilleurs flips du Bazaar de Hypixel SkyBlock selon ton budget, avec un score de risque.

👉 **https://valentinloyal.github.io/wolf-of-sky/**

## Fonctionnalités
- Meilleurs flips pour ton budget, classés par profit/heure ajusté au risque, avec temps estimé d'achat et de vente
- Score de risque (manipulation, liquidité, marge fragile, volatilité / tendance)
- Historique 7 jours, prix habituel et meilleures heures de la journée
- Calendrier SkyBlock (Spooky Festival, Season of Jerry, Jacob's Contest, …), maire en poste
- Mesure de l'effet réel des événements sur le prix de chaque item (ex. Green Candy pendant le Spooky Festival)
- Détection des écarts « gonflés » : la marge actuelle est comparée à sa valeur habituelle sur 24 h (série de 5 min), avec un profit /h prudent
- **Mon suivi** : suis tes ordres en cours (dépassé ? sous-coté ?), profit réel et rythme moyen, notifications optionnelles
- **Favoris** ⭐ : surveille des items même hors filtres, avec statut et notification quand un favori devient rentable
- Prix d'ordres à 0,1 coin près, lien de partage des réglages, affichage en cartes sur mobile
- Plan de répartition du budget sur plusieurs items, guide débutant

## Idées à venir
Voir [ROADMAP.md](ROADMAP.md) : liste d'ajouts potentiels notés par utilité et difficulté.

## Données
| Donnée | Source |
|---|---|
| Carnet d'ordres, volumes | [API Hypixel SkyBlock Bazaar](https://api.hypixel.net/skyblock/bazaar) (publique) et skyblock.bz |
| Historique des prix | [Coflnet](https://sky.coflnet.com/) |
| Maire | [API Hypixel](https://api.hypixel.net/v2/resources/skyblock/election) |
| Planning du Jacob's Contest (cultures) | [jacobs.strassburger.dev](https://jacobs.strassburger.dev/) (secours : api.elitebot.dev) |

## Fonctionnement
Le site est un seul `index.html` sans dépendance. Le workflow [`pages.yml`](.github/workflows/pages.yml) le déploie sur GitHub Pages à chaque push **et toutes les heures**, pour récupérer côté serveur le planning du Jacob's Contest (`scripts/fetch-contests.mjs` → `contests.json`), car ces API ne permettent pas d'appels depuis un navigateur.

En local, ouvre simplement `index.html` : tout marche sauf les cultures du Jacob's Contest.

Les profits affichés sont des estimations, pas une garantie.
