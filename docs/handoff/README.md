# Handoff : RushXP, plateforme esports

## Vue d'ensemble
RushXP est une plateforme esports compétitive sur l'île de La Réunion, multi-jeux et multi-structures. Elle couvre :
- les défis classés (RushXP Rankings, Elo) ;
- les rendez-vous mensuels en lobby (TFT, Warzone, Apex) ;
- un classement général des structures ;
- les Playoffs de fin de saison (2 500 €) ;
- le Match Center (veto, chat, check-in, preuves, diffusion) ;
- le recrutement et le mercato ;
- le fil communautaire, les partenaires et la publicité ;
- un espace arbitre et l'administration.

## À propos des fichiers de design
Les fichiers de `prototype/` sont des **références de design réalisées en HTML**. Ce sont des prototypes interactifs qui montrent le rendu et le comportement attendus, **pas du code de production à copier**. La tâche consiste à **recréer ces écrans dans l'environnement cible**, avec ses conventions et ses bibliothèques. Si aucun projet n'existe encore, choisir la stack la plus adaptée. Recommandation : Next.js (App Router) + TypeScript + Tailwind ou CSS Modules, Postgres + Prisma, WebSocket (chat, notifications), stockage S3 ou CDN pour les captures.

Pour ouvrir le prototype : servir le dossier `prototype/` en local (ex. `npx serve prototype`), puis ouvrir `RushXP Plateforme.dc.html`. Toute la logique et les données de démonstration se trouvent dans la classe `Component` (balise `<script data-dc-script>`) en bas du fichier. Le template HTML est au-dessus.

- Le sélecteur de **rôle** dans l'en-tête permet de voir chaque vue : visiteur, joueur, capitaine, gestionnaire, arbitre, admin.
- **Toutes les données sont fictives** (équipes, scores, statistiques). Il ne faut pas les reprendre.

## Fidélité
**Haute fidélité.** Couleurs, typographie, espacements, états et interactions sont définitifs. À reproduire au pixel près, en restant idiomatique dans le framework choisi.

## Documents
- `README.md` (ce fichier) : design, jetons, écrans, interactions.
- `SPEC_METIER.md` : rôles et droits, calendrier de saison, liste des écrans par clé de page, **modèle de données**, **règles métier** (Elo, défis, barèmes, mercato, plusieurs équipes par jeu), intégrations techniques, états à prévoir. **À lire en priorité.**

## Jetons de design

### Couleurs
| Jeton | Hex | Usage |
|---|---|---|
| `black` | `#000000` | Héros, fonds d'image |
| `bg` | `#0A0A0A` | Fond de page, champs de saisie |
| `surface` | `#141414` | Cartes, panneaux |
| `surface-2` | `#1C1C1C` | Survol, séparateurs internes, lignes sélectionnées |
| `border` | `#303030` | Toutes les bordures (1 px) |
| `orange` | `#FF9F1C` | Action primaire, onglet actif, « vous », liens |
| `yellow` | `#FFC928` | 1re place, trophées, cashprize uniquement |
| `red` | `#FF5A2A` | Erreur, sanction, direct, action destructive |
| `white` | `#F5F5F5` | Texte principal |
| `silver` | `#BFC1C4` | Texte secondaire |
| `grey` | `#8A8A8A` | Métadonnées, libellés |
| `active-tint` | `rgba(255,159,28,.08)` | Fond de ligne « vous » ou non lue |

Hiérarchie : le noir domine. L'orange est réservé aux actions et aux états actifs. Le jaune est rare (podiums). Le rouge sert aux exceptions.

### Typographie (Google Fonts)
- **Saira Condensed** 600/700/800 : titres, scores, rangs, boutons, onglets. Toujours `text-transform: uppercase`. Boutons et onglets avec `letter-spacing: .05em`.
  - H1 de page : 56–68 px, `line-height: .9–.95`.
  - Titres de carte : 20 px / 700.
  - Scores : 20–34 px / 800.
  - KPI : 30 px / 800.
- **Texte courant** : sans-serif lisible (celle définie dans le `<helmet>` du prototype), 14–16 px. Métadonnées en 12–13 px.
- **Libellés** (« overline ») : 11 px, 700, `letter-spacing: .1em`, uppercase, couleur `grey`.
- **Badges** : 10–11 px, 700, `letter-spacing: .08em`, `padding: 2px 6px`.
- **JetBrains Mono** : identifiants, URL, codes de lobby, Riot ID.
- Chiffres : `font-variant-numeric: tabular-nums` pour points, rangs et scores.

### Formes et espacement
- **Rayon : 0 partout.** Pas de coins arrondis.
- Coins coupés en `clip-path: polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px)` : uniquement pour les avatars de structure ou de joueur et les badges premium.
- Échelle d'espacement : 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 24 / 32 / 40 px.
  - Padding de carte : `14px 18px`.
  - Gouttière entre cartes : 16–20 px.
- Conteneur : `max-width: 1360px`, padding horizontal `clamp(16px,3vw,40px)`.
- En-tête de carte : `padding: 14px 18px; border-bottom: 1px solid #303030`, titre Saira 20 px à gauche, méta 12 px `grey` à droite.
- Lignes de liste : `padding: 11px 18px; border-bottom: 1px solid #1C1C1C`, survol `background: #1C1C1C`.
- Ombres : aucune. La profondeur vient des surfaces et des bordures.
- Motif : diagonales `repeating-linear-gradient(-60deg, transparent 0 22px, rgba(255,159,28,.04) 22px 23px)` sur les héros uniquement.
- Emplacements d'image : `repeating-linear-gradient(135deg,#1C1C1C 0 6px,#161616 6px 12px)` avec un libellé en mono 9–11 px (« photo joueur »). À remplacer par les vraies images.

### Boutons
| Type | Style |
|---|---|
| Primaire | fond `#FF9F1C`, texte `#0A0A0A`, Saira 700 15–16 px uppercase, hauteur 40–44 px, padding 0 16–18 px |
| Secondaire | transparent, bordure 1 px `#FF9F1C`, texte orange |
| Tertiaire | transparent, bordure `#303030`, texte `silver` |
| Destructif | bordure ou fond `#FF5A2A` |
| Désactivé | opacité .45, `cursor: not-allowed`, raison affichée en infobulle ou en texte |

Zones tactiles : 44 px minimum. Un statut n'est jamais indiqué par la couleur seule : toujours un libellé texte.

### Onglets
Hauteur 46 px, Saira 600 16 px uppercase. L'onglet actif a une bordure basse de 2 px `#FF9F1C` et un texte `white`. Les onglets inactifs sont en texte `grey` sans bordure.

## Écrans
La liste complète, clé de page par clé de page, est dans `SPEC_METIER.md` §4. Chaque écran porte un `data-screen-label` dans le prototype. Les écrans principaux, par ordre de priorité :

1. **RushXP Rankings / Centre des défis** (`rankings`). C'est l'écran central du produit.
   - Un onglet par jeu.
   - Carte « Lancer un défi » : liste des adversaires éligibles, avec les points gagnés ou perdus affichés avant d'agir.
   - Défis reçus et envoyés : accepter, refuser, choisir un créneau.
   - Divisions et Seeding.
   - Une ligne non éligible affiche la raison :
     - hors zone ;
     - même structure ;
     - quota atteint ;
     - roster incomplet.
2. **Match Center** (`matchcenter`). L'interface change selon le jeu :
   - VAL : veto des cartes.
   - CDL : veto mode + carte.
   - RL / Tekken : manches.
   - FC : score.
   - TFT : lobby de 8.

   Éléments communs : check-in, chat temps réel avec messages système distincts, envoi des preuves (OCR), diffusion (liens Twitch, Kick, YouTube, Facebook, TikTok, badges Officiel / Équipe).
3. **Classement général des structures** (`ranking`).
   - Les points viennent du barème appliqué au rang de chaque roster dans les Rankings.
   - Colonnes par jeu cliquables.
   - Règle d'égalité et de départage affichée.
4. **Calendrier** (`matches`). Défis confirmés, RDV mensuels et Playoffs, groupés par jour. Filtres : Tout / Mes matchs / Défis / Playoffs.
5. **Équipe & recrutement** (`team`).
   - Rosters, y compris **plusieurs équipes par jeu**.
   - « Ajouter une équipe ».
   - Invitations et annonces.
   - Mercato (juin).
6. **Profils structure et joueur**.
   - Structure : bannière, KPI, points par jeu, progression, résultats, palmarès, rosters, historique des points.
   - Joueur : structure et équipe, statistiques propres au jeu, forme, parcours, comptes liés.
7. **Feuille de match** (`Feuille de match.dc.html`). Statistiques lues sur la capture :
   - VAL : agents, KDA, ACS.
   - CDL : modes et cartes.
   - TFT : compositions.
   - Tekken : personnages et rounds.
8. **RDV mensuels, Playoffs** (arbre QF → finale), **Règlement**, **Paramètres**, **Espace arbitre**, **Administration**, **Messages / Notifications**, **Inscription / Création de structure** (assistants en 4 étapes), **États système**, **Vues mobiles** (référence à 375 px).

## Interactions et comportement
- Navigation : barre supérieure (Accueil, Rankings, Défis avec pastille du nombre de défis reçus, Calendrier, Classement, RDV, Actualités, Partenaires). À droite : recherche, messages, notifications, profil. Fil d'Ariane sur les pages profondes.
- Droits par rôle : les actions non autorisées sont **masquées** (outils admin) ou **désactivées avec une raison**. Elles doivent aussi être contrôlées côté serveur.
- Un visiteur qui tente une action est renvoyé vers Connexion.
- Défi : `pending → accepted → planned (créneau) → check-in → live → submitted → done`. Autres issues possibles : `refused`, `expired`, `disputed`.
- Résultats : `capture envoyée → analyse → extrait → confirmation adverse → validé auto` ou `en vérification (arbitre)` → `terminé`. Un résultat **n'est jamais présenté comme officiel avant validation** : il porte le badge « PROVISOIRE ».
- Formulaires : validation au clic, message d'erreur sous le champ en `#FF5A2A`, bordure du champ en rouge.
- Animations : rapides et sobres (150–200 ms, ease-out) sur les survols et les changements d'onglet. Aucun effet néon.
- Responsive : grilles `repeat(auto-fit, minmax(min(100%, Xpx), 1fr))` et flex-wrap. Les tableaux larges défilent horizontalement dans leur carte. Sur mobile, le Match Center passe en onglets Match / Chat / Historique.

## Gestion d'état (principale)
Session (utilisateur, rôle, structure, rosters) ; Rankings par jeu ; défis (reçus, envoyés, historique) ; match en cours (veto, check-in, chat, soumissions, liens de diffusion) ; notifications et messages non lus ; brouillons de formulaires (inscription, création de structure, annonce). Temps réel nécessaire pour : le chat, le veto, le check-in, les notifications et les compteurs de défis.

## Assets (`prototype/assets/`)
- `rushxp-logo.png`, `rushxp-logo-sm.png` : logo officiel. Ne pas étirer ni redessiner.
- `game-*.png` : logos des jeux (valorant, rl, cod, fc27, tekken, tft, warzone, apex). Ce sont des marques tierces : vérifier les droits d'usage.
- `partner-*.png`, `campaign-mcdelivery.png` : logos et visuels des partenaires, fournis par le client.
- `photo-*.jpg` : photos d'événements RushXP, fournies par le client.
- `ocr-valorant.jpg` : exemple de capture de résultat.

Les emplacements rayés (photos de joueurs, agents, personnages, logos de structures) sont à alimenter par les utilisateurs ou par des API.

## Fichiers
- `prototype/RushXP Plateforme.dc.html` : prototype complet, avec tous les écrans.
- `prototype/Feuille de match.dc.html` : composant de feuille de match, importé par le prototype.
- `prototype/support.js` : runtime du prototype. Il ne sert qu'à l'affichage et n'a pas à être porté.
- `SPEC_METIER.md` : spécification fonctionnelle et modèle de données.
