# RushXP — Dossier de passation développeurs

Référence visuelle et fonctionnelle : `RushXP Plateforme.dc.html` (prototype interactif) et `Feuille de match.dc.html`.
Toutes les données du prototype sont des **données de démonstration**. Les fonctions marquées ⚙ demandent une intégration technique (serveur, base de données, OCR, OAuth, temps réel).

---

## 1. Charte

| Jeton | Valeur | Usage |
|---|---|---|
| Noir profond | `#000000` | Héros, fonds d’image |
| Noir interface | `#0A0A0A` | Fond de page, champs |
| Surface | `#141414` | Cartes |
| Surface surélevée | `#1C1C1C` | Survol, sélection |
| Bordure | `#303030` | Bordures 1 px |
| Orange RushXP | `#FF9F1C` | Actions, éléments actifs, « vous » |
| Jaune compétition | `#FFC928` | 1re place, trophées, cashprize |
| Rouge-orangé | `#FF5A2A` | Erreurs, sanctions, direct, actions destructives |
| Blanc | `#F5F5F5` | Texte principal |
| Argent | `#BFC1C4` | Texte secondaire |
| Gris | `#8A8A8A` | Métadonnées |
| Teinte active | `rgba(255,159,28,.08)` | Ligne « vous », éléments non lus |

- **Titres, scores, rangs** : Saira Condensed 600–800, en majuscules.
- **Texte courant** : police sans-serif lisible, 14–16 px.
- **Identifiants et codes** : JetBrains Mono.
- **Formes** : angles droits (pas d’arrondis), coins coupés (`clip-path`) réservés aux avatars et badges premium.
- **Accessibilité** : zones tactiles de 44 px minimum. Un statut n’est jamais indiqué par la couleur seule : toujours un libellé (« ✓ Validé », « Incomplet », « PROVISOIRE »).

## 2. Rôles et droits

| Rôle | Accès spécifiques |
|---|---|
| Visiteur | Lecture seule. Toute action renvoie vers Inscription / Connexion |
| Joueur | Postuler, s’inscrire aux RDV solo, messages, paramètres |
| Capitaine | Lancer et accepter des défis, gérer **son** roster, inscrire duo/trio aux RDV, envoyer les résultats |
| Gestionnaire | Tous les rosters de la structure, annonces, transferts, page structure |
| Arbitre | Espace arbitre, sections admin : tableau de bord, RDV mensuels, matchs, veto, résultats, contestations, sanctions |
| Admin | Tout, y compris barèmes, Rankings, partenaires, publicités, audit |

Les droits doivent être contrôlés **côté serveur**. Le masquage dans l’interface ne suffit pas.

## 3. Saison

| Période | Phase |
|---|---|
| Janv. → févr. | Placement (5 matchs, score provisoire 800) |
| Mars → mai | Split 1 · défis classés |
| Juin | Mercato (transferts entre structures) |
| Juil. → sept. | Split 2 · défis classés |
| 30 sept. 23:59 | Seeding officiel figé (horodatage + hash) |
| Oct. → nov. | Playoffs · top 8 de la Division 1, élimination directe, 2 500 € |

- **Jeux à défis** (RushXP Rankings, Elo) : Valorant 5v5, Rocket League 3v3, CDL 4v4, FC 27 1v1, Tekken 8 1v1.
- **Jeux en lobby**, en rendez-vous mensuels de 6 manches :
  - TFT : solo, lobbys de 8, recomposés selon le cumul.
  - Warzone : duo.
  - Apex Legends : trio.
- Les **formats sont des paramètres**, pas des constantes : taille de roster, série, barème, taille de lobby.

## 4. Écrans (clé de page → contenu)

| Clé | Écran | Points clés |
|---|---|---|
| `home` | Accueil | Héros saison, « Pour vous » selon le rôle, compétitions, classement, actus, partenaires |
| `rankings` | RushXP Rankings | Onglets Classement / Centre des défis / Divisions / Seeding. Le Centre des défis est l’écran principal |
| `ranking` | Classement général des structures | Somme des barèmes par jeu, détail cliquable, égalités |
| `mvp` | Joueurs & MVP | Classement individuel (ne donne pas de points), succès XP |
| `matches` | Calendrier | Défis confirmés + RDV mensuels + Playoffs, filtres |
| `matchcenter` | Match Center | Spécifique au jeu : veto VAL/CDL, manches RL/Tekken, lobby TFT. Chat, check-in, preuves, diffusion |
| `sheet` | Feuille de match | Statistiques lues sur la capture (agents, KDA, cartes, compos) |
| `events` | RDV mensuels | Inscription, format, barème, résultats par manche et par lobby |
| `playoffs` | Playoffs | Arbre QF → finale, qualifiés, cashprize, dates |
| `competition` | Compétition par jeu | Onglets selon la phase. Arbre et tirage quand ils existent |
| `team` | Équipe & recrutement | Rosters, invitations, annonces, mercato |
| `structure` / `player` | Profils | Statistiques, historique des points, palmarès |
| `signup` / `newstruct` | Inscription, création de structure | Assistants en 4 étapes avec validation |
| `messages` / `notifications` | Messagerie, notifications | Signalement, préférences site / e-mail |
| `settings` | Paramètres | Profil, sécurité (2FA, sessions), comptes liés, confidentialité |
| `referee` | Espace arbitre | File priorisée, preuve, comparaison des valeurs, décision motivée |
| `admin` | Administration | Navigation latérale, saisie des RDV, paramètres Rankings, audit |
| `rules` | Règlement | Général + règles propres à chaque jeu, versionné |
| `status` | États système | 404, maintenance, compte suspendu, connexion perdue |
| `mobile` | Vues mobiles | Référence à 375 px |

## 5. Modèle de données (proposition)

```
User(id, pseudo, email, role, region, xp, level, status[active|suspended], twoFA)
GameAccount(userId, game, provider[riot|activision|ea|epic|bandai], externalId, verifiedAt)
Structure(id, name, tag, region, logoUrl, verifiedAt, status[draft|pending|verified])
Roster(id, structureId, game, name, captainId)   // plusieurs rosters possibles par (structureId, game)
RosterMember(rosterId, userId, role[starter|sub], joinedAt, leftAt)
Transfer(id, userId, fromStructureId?, toStructureId, game, kind[signing|transfer|release], status, window)
RecruitAd(id, kind[structure|player], authorId, game, role, level, availability, text, expiresAt, moderation)
RankingEntry(game, entityId, score, k, placementMatches, division, lastMatchAt, immunityUntil)
Challenge(id, game, challengerId, defenderId, status[pending|accepted|planned|submitted|done|refused|expired], slot, stakes{win,loss}, origin[manual|auto])
Match(id, game, type[challenge|playoff], a, b, series, scheduledAt, checkIn{a,b}, status, streamLinks[])
Veto(matchId, steps[{actor, action[ban|pick|side], map, mode}])
ResultSubmission(id, matchId|eventRoundId, uploaderId, fileUrl, ocr{values, confidence}, declared{a,b}, status)
Dispute(id, submissionId, openedBy, reason, evidence[], decision, refereeId, decidedAt)
Sanction(id, targetType, targetId, type, reason, article, until)
MonthlyEvent(id, game, month, date, checkInAt, capacity, status)
EventEntry(eventId, entityId, members[])
EventRound(eventId, n, lobbies[{code, entries[]}], status[pending|entry|published])
EventResult(roundId, entryId, placement, kills, points, source[ocr|manual])
SeedSnapshot(id, game, takenAt, hash, rows[])
Notification(id, userId, category, text, link, readAt)
Message(threadId, authorId, text, createdAt, reported)
AuditLog(id, actorId, action, target, before, after, at)
```

## 6. Règles métier à implémenter

- **Elo** : K = 40 pendant les 5 matchs de placement, puis 32. Gains et pertes affichés **avant** d’accepter un défi.
- **Défis** :
  - Zone de défi : 2 rangs au-dessus, 1 en dessous. 2 défis en attente maximum. Réponse sous 48 h (relance à 24 h).
  - Refus injustifié : −40 points.
  - 2 matchs comptés maximum par paire d’adversaires sur 30 jours glissants.
- **Classement général des structures** :
  - Barème par jeu selon le rang du roster : 100 / 90 / 82 / 75 / 69 / 64 / 60 / 56, puis −4 par rang (minimum 5).
  - Jeux 1v1 : c’est le meilleur joueur de la structure qui compte.
  - Jeux en lobby : on prend le rang de la structure au cumul de la saison des RDV.
- **Barème des RDV mensuels** :
  - TFT : 8 → 1 selon la place.
  - Warzone : 15 / 12 / 10 / 8 / 6 / 5 / 4 / 3 / 2 / 1, plus 1 point par élimination.
  - Apex : 12 / 9 / 7 / 5 / 4 / 3 / 3 / 2 / 2 / 2 / 1 ×5, plus 1 point par élimination.
- **Plusieurs équipes par jeu** : une structure peut engager plusieurs rosters sur un même jeu (ex. No Fear Arise / No Fear Academy).
  - Chaque roster a son propre classement dans les Rankings.
  - Deux équipes de la même structure ne peuvent pas se défier.
  - Seule l’équipe la mieux classée compte au classement général.
  - Un joueur ne peut être que dans une seule équipe par jeu.
- **Mercato** :
  - En dehors de juin, seuls les agents libres peuvent signer.
  - Un transfert demande l’accord des deux structures et du joueur, puis la validation RushXP.
  - Un roster incomplet ne peut ni lancer ni accepter de défi.
- **Résultats** : un résultat n’est **jamais affiché comme officiel avant validation**. Une confiance OCR faible, ou des déclarations différentes entre les deux équipes, envoie le résultat à l’arbitre.
- **Corrections** : toute correction recalcule les Rankings et le classement général, et écrit une ligne dans le journal d’audit.

## 7. Intégrations ⚙

| Besoin | Piste |
|---|---|
| Liaison des comptes | OAuth Riot (RSO), Activision, EA, Epic, Bandai Namco / Steam |
| Lecture des captures | Service OCR et vision avec un modèle par jeu, score de confiance par champ |
| Chat de match, messages, notifications | WebSocket ou équivalent, avec gestion de la reconnexion (écran « Connexion perdue ») |
| Diffusion | Validation des domaines Twitch, Kick, YouTube, Facebook, TikTok |
| Notifications e-mail | Service transactionnel |
| Paiement du cashprize | Hors plateforme. Contrôle d’identité et autorisation parentale |
| Stockage | Captures, logos, médias du fil (CDN) |

## 8. États à prévoir partout

Chargement, vide, erreur, action interdite (rôle), connexion interrompue, contenu supprimé, compétition terminée, égalité, correction de résultat, maintenance, compte suspendu, 404.
