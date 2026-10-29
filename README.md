# RushXP v2 · plateforme esports

Plateforme compétitive multi-jeux et multi-structures de La Réunion : RushXP Rankings (Elo), défis classés, RDV mensuels, classement général des structures, Playoffs.

Références : `docs/handoff/README.md` (design) et `docs/handoff/SPEC_METIER.md` (métier, **à lire en priorité**).

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Postgres + Prisma 7 (`prisma/schema.prisma`)
- Vitest pour les règles métier

## Démarrer

```bash
npm install
cp .env.example .env   # renseigner DATABASE_URL
npm run dev            # http://localhost:3000
npm test               # tests des règles métier
npm run build
```

Le site fonctionne **sans base de données** pour l'instant : les écrans lisent des données de démonstration (`src/lib/data/demo.ts`), derrière `src/lib/data/repo.ts`, qui sera branché sur Prisma.
Le sélecteur « Voir en tant que », dans la barre du haut, simule les rôles (visiteur, joueur, capitaine, gestionnaire, arbitre, admin).

## Organisation

| Dossier | Contenu |
|---|---|
| `src/lib/rules/` | Règles métier pures et testées : Elo, éligibilité aux défis, barèmes, classement général |
| `src/lib/data/` | Configuration des jeux, données de démo, accès aux données (`repo.ts`) |
| `src/lib/rankings-model.ts` | Classement « vivant » et contexte d'éligibilité |
| `src/components/` | En-tête, pied de page, onglets, écrans Rankings |
| `src/app/` | Routes. `[...slug]` sert les écrans pas encore développés |
| `prisma/schema.prisma` | Modèle de données complet (SPEC §5) |
| `public/assets/` | Logos, jeux, partenaires et photos fournis |

## Avancement

**Lot 0 (fait)**
- Jetons de design (couleurs, Saira Condensed / Barlow / JetBrains Mono, rayon 0), en-tête avec navigation et pastille des défis, pied de page, 404.
- Accueil : héros, bloc « Pour vous » selon le rôle, calendrier de saison calculé à la date du jour, jeux, top 5, partenaires.
- **RushXP Rankings** :
  - Classement avec filtres, profil latéral et bouton « Défier » ;
  - **Centre des défis** : enjeux affichés avant d'agir, raisons de non-éligibilité, choix de créneau, refus avec ou sans motif (−40), résultat PROVISOIRE, puis confirmation ou contestation, puis recalcul ;
  - Divisions avec montées et descentes ;
  - Aperçu du seeding.
- Classement général des structures, avec colonnes par jeu triables et gestion des égalités.
- Schéma Prisma de toutes les entités. 12 tests de règles.

**Lots suivants (proposés)**
1. Authentification et rôles côté serveur, inscription et création de structure (assistants en 4 étapes), migration Postgres et seed.
2. Défis persistés (server actions et transitions contrôlées), calendrier, Match Center (veto, check-in, chat WebSocket, preuves), équipes et recrutement (plusieurs équipes par jeu, mercato).
3. RDV mensuels, Playoffs, profils, espace arbitre, administration (barèmes, audit), Joueurs & MVP.
4. Actualités, partenaires, messages et notifications, paramètres, règlement, états système, OCR, OAuth des comptes de jeu.

## Points à valider avec RushXP

- **Départage au classement général** : la spec demande d'afficher la règle sans la définir. Le texte affiché (nombre de jeux classés, puis meilleur rang, puis résultat direct) est une **proposition**.
- « Prochaine échéance » de l'accueil : donnée de démonstration, à relier au calendrier réel.
- État des défis en démo : il est stocké dans le navigateur (`sessionStorage`). En production, tout passera par le serveur.
