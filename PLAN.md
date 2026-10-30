# RushXP · Plan de développement

> Étape 1 du prompt « RushXP — Prompt Claude Code ». **Aucun code n’est écrit avant validation de ce plan.**
> Ce plan part de l’existant (dépôt `shinkyo97490/rushxp`, en ligne sur https://rushxp.vercel.app) et liste ce qu’il reste à construire.

## 0. Sources

| Source | État |
|---|---|
| Prompt Claude Code (export Claude Design) | ✅ lu |
| `design_handoff_rushxp/` : `README.md`, `SPEC_METIER.md`, prototype `RushXP Plateforme.dc.html`, `Feuille de match.dc.html`, `assets/` | ✅ lus (version du premier zip) |
| **Nouvelle version du prototype** `RushXP_Plateforme.dc.html` (32 écrans : LAN, `CMS_DEF`, map pool et cycles) | ✅ reçue le 30 oct. 2026 |
| `Passation développeurs.md` | ❌ toujours manquant (non indispensable : le prototype contient les données) |

### Écarts entre le prototype et les décisions validées

Les décisions validées priment ; le prototype est aligné dessus dans le code.

| Sujet | Prototype | Retenu |
|---|---|---|
| Phases | Seeding janv. → févr., Split 1 mars → mai, Split 2 juil. → sept., Playoffs oct. → nov. | D1 : pré-saison janv. → avr., saison mai → août, Playoffs sept. → déc. Les cycles de cartes suivent ces phases. |
| Barème LAN | 150 · 120 · 100 · 85 · 60 (5e–8e) · 20 | D7 : Rankings + 50 (150 · 140 · 132 · 125 · 119 · 114 · 110 · 106…). **À confirmer** si le prototype reflète une décision plus récente. |
| Paiement | Carte, HelloAsso, PayPal | D5 : Stripe (carte bancaire). |
| Mercato (onglet équipe) | Fenêtres de mercato | D1-a : transferts libres. |

## 1. Décisions (validées le 30 oct. 2026)

| # | Sujet | Décision |
|---|---|---|
| D1 | Calendrier de saison | **Pré-saison janv. → avr. · saison régulière mai → août · Playoffs sept. → déc.** Paramétrable en base (`Season`, `SeasonPhase`). |
| D1-a | Mercato | **Pas de mercato.** Esport amateur : transferts possibles toute l’année. Le joueur rejoint sa nouvelle structure et quitte l’ancienne automatiquement (historique conservé, anciens gestionnaires notifiés). Garde-fou : **un joueur ne dispute les Playoffs que pour une seule équipe par saison** (contrôlé quand les matchs seront en base). |
| D1-b | Seeding figé | **31 août, 23:59** (horodatage + empreinte). |
| D2 | Authentification | Better Auth (déjà en production). |
| D3 | Temps réel | Ably, derrière une interface `Realtime` (mock en développement). |
| D4 | Tâches programmées | Table `Job` + route `/api/cron/jobs` protégée par `CRON_SECRET`. Sur l’offre Vercel Hobby, le cron Vercel ne tourne qu’une fois par jour : pour un passage chaque minute, offre Pro ou service de déclenchement externe. |
| D5 | Paiement des LAN | **Stripe**, derrière une interface `Payments` (mock en développement). |
| D6 | Stockage | Vercel Blob, derrière une interface `Storage`. |
| D7 | Barème LAN | **Barème des Rankings + 50 points** (150 / 140 / 132 / 125 / 119 / 114 / 110 / 106, puis −4 par rang, minimum 55). |
| D8 | Pré-saison | Les matchs classent (Elo) mais **ne comptent pas** au classement général. |

## 2. Architecture

```
Next.js 16 (App Router, Server Components, Server Actions) · TypeScript strict
├─ src/app/                 routes (pages + api/cron + api/webhooks)
├─ src/components/ui/       bibliothèque : Button, Field, Tabs, Badge, Card, Table, Modal, Toast, ChatBlock, PostCard, AdSlot…
├─ src/components/<domaine>/ composants métier (rankings, match, team, lan, admin/cms…)
├─ src/lib/rules/           règles pures et testées (Elo, éligibilité, barèmes, roster et transferts, cycles de cartes, saison)
├─ src/lib/<domaine>/       actions serveur ("use server") + requêtes (server-only), droits vérifiés à chaque action
├─ src/lib/integrations/    interfaces + mocks : realtime, ocr, payments, storage, email, oauth-games, streams
└─ prisma/                  schéma, migrations, seed (référentiel) + seed:dev (démo, jamais en production)
```

- **Droits** : chaque action serveur appelle `requireRole()` / `requireStaffOf()`. Les pages admin et arbitre renvoient 404 aux autres rôles. Déjà en place, à généraliser.
- **Données de démonstration** : retirées des pages. Elles passent dans un `prisma/seed-dev.ts` lancé seulement en local (`npm run db:seed:dev`), avec un drapeau `isDemo` sur les lignes créées.
- **Journal d’audit** : un helper `audited(action, target, before, after)` autour de chaque opération sensible. Confirmation obligatoire côté interface.

## 3. Schéma Prisma

Existant (36 modèles) : comptes et sessions, jeux, structures, équipes et rosters, membres, invitations, transferts, annonces, `RankingEntry`, `Challenge`, `Match`, `Veto`, `ResultSubmission`, `Dispute`, `Sanction`, RDV mensuels, `SeedSnapshot`, notifications, messagerie, audit, fil d’actualité, sondages, demandes partenaires.

À **ajouter** ou **modifier** :

| Domaine | Modèles | Notes |
|---|---|---|
| Saison | `Season`, `SeasonPhase` (kind: PRESEASON / REGULAR / PLAYOFFS / BREAK, startsAt, endsAt, countsForGeneral, monthlyEvents) | Remplace les constantes de `src/lib/season.ts` (D1) |
| Classement général | `PointsLedger` (structureId, game, source: RANKINGS / RDV / LAN, refId, points, computedAt, reason) | Chaque recalcul réécrit le grand livre : le détail cliquable « d’où viennent les points » en découle |
| Défis | `Challenge` : + `proposedSlots` validés, `remindedAt`, `autoPaired` ; `ChallengeSlot` si besoin | Relance à 24 h et expiration à 48 h par `Job` |
| Match | `Match` : + `checkInDeadline`, `forfeitBy` ; `MatchEvent` (journal officiel) ; `ChatMessage` (kind: SYSTEM / USER / REFEREE) ; `StreamLink` (platform, url, official, addedBy) ; `MatchGame` (manche : carte, mode, score, personnages) | Veto existant conservé, avec le pool figé au démarrage |
| Feuille de match | `PlayerMatchStat` (matchGameId, userId, game, stats Json, confidence Json) | Alimente les statistiques des profils |
| Map pool | `MapPool` (game, mode?, maps[], cycleId), `MapCycle` (name, game, effectiveAt, scope, status: DRAFT / SCHEDULED / ACTIVE / CANCELLED / ARCHIVED, announce) | Activation par `Job` à 00:00 ; tailles validées (VAL 7 ; CDL HP 4, S&D 5, CTRL 3) |
| LAN | `LanEvent` (organizer, venue, dates, poster, games[], prices, capacity, registrationStatus, paymentProvider, refundUntil, parentalConsent, scale), `LanRegistration` (team/solo, rosterId?, members, status), `Payment` (provider, externalId, amount, status, receiptUrl), `LanResult` | Paiement par webhook, remboursement avant la date limite |
| Éditeur générique | `ContentItem` (type: COMPETITION / LAN / NEWS / POLL / PARTNER / HOME, status: DRAFT / SCHEDULED / PUBLISHED / ARCHIVED, publishAt, data Json validé par schéma Zod par type, version) | Un seul éditeur, des schémas par type repris de `CMS_DEF` |
| Compétitions | `Competition` (game, type, format, series, rosterSize, maxEntrants, veto, registration window, fee, checkIn, multiTeam, scale, countsForGeneral, rulesVersion, prize) | Créées via l’éditeur générique |
| Partenaires & publicités | `Partner` (category, tier, site, logo, slots), `AdSlot`, `AdCampaign` (dates, cap, freq), `AdStat` (impressions, clics par jour) | Remplace les contenus en dur |
| Communauté | `Follow` (userId → structure ou joueur), `Reaction` (sur Post et commentaire) | Bouton Suivre, réactions |
| Règlement | `RuleSet` (version, publishedAt, contenu par jeu) | Règlement versionné |
| Système | `Job` (kind, runAt, payload, status, attempts), `SiteSetting` (maintenance, accueil) | |
| Comptes | `User` : + `twoFactor` (plugin Better Auth) ; `GameAccount.verifiedAt` renseigné par OAuth | |

## 4. Routes

Existantes (31) : `/`, `/rankings` (+ `/defis`, `/divisions`, `/seeding`), `/classement`, `/mvp`, `/calendrier`, `/match`, `/feuille-de-match`, `/competitions`, `/playoffs`, `/rdv`, `/actualites` (+ `/nouvelle`), `/recrutement`, `/partenaires`, `/le-circuit`, `/reglement`, `/joueur/[pseudo]`, `/structure/[tag]`, `/structure/nouvelle`, `/messages`, `/notifications`, `/parametres`, `/profil`, `/arbitrage`, `/admin`, `/connexion`, `/inscription`, `/etat/[code]`.

À ajouter ou restructurer :
- `/match/[id]` et `/match/[id]/feuille` : vrais matchs (aujourd’hui `/match?jeu=` sert la démo).
- `/competitions/[slug]` : une compétition, avec onglets selon la phase, arbre de tournoi et tirage animé des poules.
- `/lan`, `/lan/[slug]`, `/lan/[slug]/inscription`, `/lan/[slug]/paiement/retour`.
- `/admin/[section]` : sections en routes plutôt qu’en paramètre `?s=` ; `/admin/contenu/[type]` (liste filtrable), `/admin/contenu/[type]/[id]` (éditeur + aperçu en direct), `/admin/map-pool/[game]`.
- `/api/cron/jobs` (Vercel Cron), `/api/webhooks/payments`, `/api/realtime/auth`, `/api/uploads`.

## 5. Bibliothèque de composants (étape 2)

`src/components/ui/` avec, pour chacun, les états normal, survol, actif, désactivé (raison affichée), chargement, succès, erreur et avertissement :

Button (primaire, secondaire, tertiaire, destructif) · Field, Select, TextArea, Checkbox, Switch, FileDrop · Tabs, Steps · Badge (statut, toujours avec un libellé) · Card, CardHead · Table (défilement horizontal dans la carte) · Modal, ConfirmDialog · Toast (pile, aria-live) · ChatBlock (messages système, arbitre, utilisateur, fichier, hors ligne) · PostCard (officiel, structure, sponsorisé, sondage, média) · AdSlot (label visible) · Bracket · StatBar · EmptyState, ErrorState.

Une page interne `/admin/ui` (réservée aux admins) montrera tous les états pour la revue visuelle.

## 6. État par écran

| Écran | Aujourd’hui | Reste à faire |
|---|---|---|
| Accueil, bloc « Pour vous » | Fait | Contenu piloté par `ContentItem HOME`, prochaine échéance réelle |
| RushXP Rankings, Centre des défis | Interface complète, **données démo** | Passage en base : entrée en placement, défis, appariements auto, relance et expiration, refus −40, recalcul Elo, limite par paire |
| Calendrier | Démo | Défis confirmés, RDV, Playoffs, LAN en base ; filtre « LAN » |
| Classement général | Démo | Grand livre `PointsLedger` (Rankings, RDV, LAN), détail cliquable, égalités |
| Match Center | Interface complète par jeu, **état local** | Persistance, temps réel, check-in avec forfait automatique, diffusion annoncée dans le chat, OCR mocké derrière l’interface, journal officiel |
| Feuille de match | Démo | `PlayerMatchStat`, liens depuis profils et calendrier |
| Espace arbitre | Signalements réels, contestations démo | `Dispute` en base, preuve à côté des valeurs, décision motivée, sanction |
| Structures, équipes, recrutement, transferts | **Réel** | Bouton Suivre, KPI réels (rang, points, écart au leader, titres) |
| Profil joueur | Réel (sans statistiques) | Statistiques par jeu, forme sur 10 matchs, distinctions |
| Joueurs & MVP | Démo | Élection MVP par match, succès XP réels |
| RDV mensuels | Inscriptions réelles, résultats démo | Saisie arbitre (lobbys, placements, éliminations), recomposition TFT, cumul saison |
| Playoffs | Démo | Génération depuis le seeding figé |
| Compétition par jeu | Partiel | Onglets selon la phase, tirage animé, depuis `Competition` |
| **LAN & événements** | **Fait** (`/lan`, console › LAN) : fiche avec compte à rebours, onglets Infos / Tournois & tarifs / Inscrits / Résultats / Inscription, inscription équipe ou solo en 4 étapes, paiement Stripe simulé (désactivé en production tant que Stripe n’est pas branché), annulation et remboursement, saisie du classement par les arbitres, validation, points par structure (meilleur classement par jeu) | Adaptateur Stripe réel + webhook signé, billet QR, autorisation parentale (mineurs), envoi d’affiche, points LAN dans le grand livre du classement général (lot B) |
| Actualités | Réel (posts, j’aime, commentaires, sondages) | Réactions multiples, médias (stockage), sponsorisé piloté par `AdCampaign`, notification aux abonnés |
| Partenaires, publicités | Contenu en dur, campagnes démo | `Partner`, `AdCampaign`, mesure des impressions et clics |
| **Administration, éditeur générique** | Sections réelles (structures, utilisateurs, annonces, sanctions, formats, audit…) | Navigation par domaine, bloc « Créer », **éditeur générique** (liste, sections numérotées, aperçu en direct, vérifications, brouillon, programmer, publier), **map pool et cycles**, saisie des RDV, règlements versionnés, publicités |
| Messagerie, notifications | Réel (rafraîchissement 10 s) | Temps réel, e-mails |
| Paramètres | Réel | 2FA, OAuth des comptes de jeu |
| Inscription, création de structure | Réel | Liaison OAuth des comptes de jeu |
| États système | Fait | Mode maintenance piloté par `SiteSetting` |
| Mobile 375 px | Vérifié sur toutes les routes | À revérifier à chaque lot |

## 7. Ordre de travail (adapté à l’existant)

Les étapes 1 à 3 du prompt sont en grande partie faites : connexion, rôles, mise en page et la plupart des pages existent déjà. Ordre proposé :

1. **Lot A · Fondations** : `src/components/ui/` avec tous les états, et migration progressive des pages vers ces composants ; `Season` / `SeasonPhase` ; seed de développement séparé ; `Job` + Vercel Cron ; interfaces d’intégration avec mocks.
2. **Lot B · Cœur compétitif** : Rankings et défis en base, appariements automatiques, relances et expirations, recalcul Elo ; calendrier réel ; grand livre du classement général et détail cliquable.
3. **Lot C · Match Center** : matchs en base, veto avec pool figé, check-in et forfait automatique, chat temps réel (Ably), diffusion, OCR mocké, feuille de match, contestations et décisions d’arbitre.
4. **Lot D · Structures et profils** : Suivre, KPI réels, statistiques par jeu, MVP et succès XP.
5. **Lot E · Événements** : saisie des RDV et recomposition TFT, Playoffs depuis le seeding, compétitions et tirage animé. ~~LAN avec paiement mocké~~ (fait en avance, d’après le prototype).
6. **Lot F · Administration** : navigation par domaine, bloc Créer, **éditeur générique** (selon `CMS_DEF`), **map pool et cycles**, règlements versionnés, publicités.
7. **Lot G · Communauté** : réactions, médias, sponsorisé, notifications aux abonnés, e-mails, 2FA, OAuth des comptes de jeu.
8. **Lot H · Qualité** : passage complet en mobile et accessibilité, tests Playwright des parcours clés, comparaison écran par écran avec le prototype.

À la fin de chaque lot : comparaison avec le prototype écran par écran, liste de ce qui reste, commit, déploiement.

## 8. Tests

- **Vitest** (17 tests aujourd’hui) : à étendre au calendrier de saison paramétré, au grand livre du classement général (multi-équipes, 1v1, lobby, LAN, égalités), aux transitions de défi et aux expirations, aux transferts, à la validation des résultats (confiance OCR, désaccord), aux cycles de cartes (tailles, activation à 00:00, veto déjà commencé), et aux remboursements LAN.
- **Playwright** : inscription, création de structure, composition de roster ; défi complet (envoi, créneau, match, résultat, validation, recalcul) ; inscription LAN avec paiement mock ; publication programmée dans l’éditeur ; parcours mobile à 375 px.

## 9. Ce qu’il me faut de votre côté

1. ~~Valider les décisions D1 à D8.~~ Fait.
2. ~~L’export à jour du prototype.~~ Reçu. Reste à confirmer le barème LAN (voir écarts ci-dessus).
3. Plus tard, au fil des lots : comptes Ably, Stripe, Vercel Blob, un service d’e-mail (Resend), l’application Discord, et une demande d’accès Riot RSO.
