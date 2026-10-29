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
cp .env.example .env   # renseigner DATABASE_URL et BETTER_AUTH_SECRET
npm run db:migrate     # crée les tables
npm run db:seed        # jeux et formats
npm run dev            # http://localhost:3000
npm test               # tests des règles métier
```

### Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion Postgres (poolée sur Neon). Ajoutée par l'intégration Neon de Vercel |
| `DATABASE_URL_UNPOOLED` | Connexion directe pour les migrations. Ajoutée par Neon |
| `BETTER_AUTH_SECRET` | Secret de signature des sessions, **à créer** (`openssl rand -base64 32`). Sans lui, personne ne peut se connecter en production |
| `BETTER_AUTH_URL` | Facultatif sur Vercel (URL déduite automatiquement) |

### Déploiement (Vercel)

Le script `vercel-build` applique les migrations (`prisma migrate deploy`), charge les données de référence (`prisma db seed`, idempotent), puis construit le site.

### Rôles

Le rôle est calculé côté serveur à chaque requête (`src/lib/auth/roles.ts`) :
- **Admin** et **Arbitre** sont attribués par RushXP (colonne `User.role`) ;
- **Gestionnaire** : gère une structure ;
- **Capitaine** : capitaine d'un roster ;
- sinon **Joueur**, et **Visiteur** hors connexion.

Pour nommer un administrateur, ouvrez l'éditeur SQL de Neon (Vercel, puis Storage, puis Open in Neon) et lancez :

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'votre@email.fr';
```

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

**Lot 1 (fait)**
- Base Postgres (Prisma 7, migrations, seed des jeux), déploiement Vercel avec migrations automatiques.
- Connexion par e-mail ou pseudo (Better Auth, sessions en base, comptes suspendus bloqués), déconnexion.
- Inscription en 4 étapes : compte, jeux et identifiants (non vérifiés), profil, structure (créer, rejoindre par code, agent libre).
- Création de structure en 4 étapes : identité, jeux (un roster par jeu), invitations par pseudo, validation. La structure est créée « en vérification », avec un code d'invitation, des notifications et une ligne d'audit.
- Rôles calculés côté serveur ; Admin et Arbitrage invisibles (404) pour les autres rôles.

**Lots suivants (proposés)**
2. Défis persistés (server actions et transitions contrôlées), calendrier, Match Center (veto, check-in, chat WebSocket, preuves), équipes et recrutement (plusieurs équipes par jeu, mercato).
3. RDV mensuels, Playoffs, profils, espace arbitre, administration (barèmes, audit), Joueurs & MVP.
4. Actualités, partenaires, messages et notifications, paramètres, règlement, états système, OCR, OAuth des comptes de jeu.

## Points à valider avec RushXP

- **Départage au classement général** : la spec demande d'afficher la règle sans la définir. Le texte affiché (nombre de jeux classés, puis meilleur rang, puis résultat direct) est une **proposition**.
- « Prochaine échéance » de l'accueil : donnée de démonstration, à relier au calendrier réel.
- État des défis en démo : il est stocké dans le navigateur (`sessionStorage`). Les Rankings et les défis passeront sur la base au lot 2 (rosters complets, puis entrée en placement).
- Pas encore d'e-mail transactionnel : ni vérification d'adresse ni mot de passe oublié. Il faut choisir un service d'envoi (ex. Resend).
- Connexion Discord : il faut créer une application Discord (identifiants OAuth).
