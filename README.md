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
| `CRON_SECRET` | Secret des tâches programmées (`/api/cron/jobs`), **à créer**. Vercel Cron l’envoie automatiquement |
| `ABLY_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BLOB_READ_WRITE_TOKEN`, `RESEND_API_KEY`, `OCR_API_KEY` | Intégrations. Tant qu’elles sont vides, une version simulée prend le relais (état visible dans Administration › Tableau de bord) |

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

**Lot 2 · toutes les pages (fait)**

Chaque écran du prototype a sa route.

| Données | Pages |
|---|---|
| **Réelles (base)** | Équipe & recrutement (rosters, plusieurs équipes par jeu, invitations, demandes par code, capitaine, effectif, libération, annonces modérées, mercato), notifications (préférences), messages privés (signalement), paramètres (profil, mot de passe, sessions, comptes de jeu, confidentialité, export RGPD, suppression), profils joueur et structure, administration (tableau de bord, vérification des structures, rôles et suspensions, annonces, sanctions, formats et barèmes, diffusion, demandes partenaires, audit), espace arbitre (signalements), actualités (publications officielles et de structures, j’aime, commentaires, sondages), inscriptions aux RDV mensuels, formulaire « Devenir partenaire » |
| **Démonstration (étiquetée)** | RushXP Rankings et défis, calendrier, Match Center (veto VAL / CDL, lobby RL, score FC, set Tekken, lobby TFT, check-in, diffusion, OCR, chat), feuille de match, Playoffs, résultats des RDV passés, Joueurs & MVP, file de contestations, campagnes publicitaires |
| **Contenu éditorial** | Le circuit, règlement, partenaires, états système (`/etat/maintenance`, `/etat/suspendu`, `/etat/connexion-perdue`) |

**Lot A · fondations (fait)** · voir `PLAN.md`
- Saison paramétrable en base (`Season`, `SeasonPhase`) : pré-saison janv. → avr. (hors classement général), saison régulière mai → août, Playoffs sept. → déc., seeding figé le 31 août à 23:59. Calendrier, textes et règlement mis à jour.
- Pas de mercato : transferts libres toute l’année (départ automatique de l’ancienne structure, historique, notifications).
- Barème LAN : barème des Rankings + 50 points.
- Bibliothèque de composants `src/components/ui/` avec tous les états, revue visuelle sur `/admin/ui`.
- File de tâches (`Job`) et route `/api/cron/jobs` (Vercel Cron quotidien à minuit, heure de La Réunion).
- Interfaces d’intégration avec versions simulées : temps réel, OCR, paiement (Stripe), stockage, e-mails.

**Lots suivants**
Lots B à H : voir `PLAN.md` §7 (cœur compétitif, Match Center, structures et profils, événements et LAN, administration, communauté, qualité).

## Points à valider avec RushXP

- **Départage au classement général** : la spec demande d'afficher la règle sans la définir. Le texte affiché (nombre de jeux classés, puis meilleur rang, puis résultat direct) est une **proposition**.
- « Prochaine échéance » de l'accueil : donnée de démonstration, à relier au calendrier réel.
- État des défis en démo : il est stocké dans le navigateur (`sessionStorage`). Les Rankings et les défis passent en base au lot B.
- Pas encore d'e-mail transactionnel : ni vérification d'adresse ni mot de passe oublié. Il faut choisir un service d'envoi (ex. Resend).
- Connexion Discord : il faut créer une application Discord (identifiants OAuth).
