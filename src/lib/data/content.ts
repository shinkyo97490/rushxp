/**
 * Contenus éditoriaux (règlement, guide, partenaires fournis par le client, formats des RDV).
 * Ce ne sont pas des données de démonstration : ils viennent du dossier de passation et seront
 * gérés depuis l'administration (règlement versionné) dans un lot ultérieur.
 */

export const RULES_VERSION = "2026.3";
export const RULES_UPDATED = "12 oct. 2026";

export const RULES_GENERAL: { title: string; items: [string, string][] }[] = [
  {
    title: "Inscription",
    items: [
      ["1.1", "Toute personne de 13 ans ou plus peut créer un compte. Les mineurs de moins de 16 ans fournissent une autorisation parentale avant tout versement de cashprize."],
      ["1.2", "Une structure peut engager plusieurs équipes sur un même jeu (ex. No Fear Arise et No Fear Academy). Chaque équipe a son propre classement RushXP Rankings."],
      ["1.2 bis", "Un joueur ne peut appartenir qu’à une seule équipe par jeu. Deux équipes d’une même structure ne peuvent pas se défier. Seule l’équipe la mieux classée compte au classement général."],
      ["1.3", "Chaque joueur lie le compte de jeu utilisé en compétition. Jouer avec un autre compte entraîne la perte du match."],
    ],
  },
  {
    title: "Saison et phases",
    items: [
      ["2.1", "La saison comprend le placement (janvier–février), le Split 1 (mars–mai), le mercato (juin), le Split 2 (juillet–septembre) et les Playoffs (octobre–novembre)."],
      ["2.2", "Le seeding officiel est figé le 30 septembre à 23:59. Les 8 premiers de la Division 1 de chaque jeu sont qualifiés pour les Playoffs."],
      ["2.3", "Les jeux en lobby (TFT, Warzone, Apex Legends) se jouent en rendez-vous mensuels de 6 manches."],
    ],
  },
  {
    title: "Défis et RushXP Rankings",
    items: [
      ["3.1", "Un roster peut défier une équipe jusqu’à 2 rangs au-dessus et 1 rang en dessous. 2 défis en attente maximum."],
      ["3.2", "Le défié répond sous 48 h. Un refus injustifié coûte 40 points."],
      ["3.3", "Deux structures ne peuvent compter que 2 matchs entre elles sur 30 jours glissants."],
    ],
  },
  {
    title: "Retards et forfaits",
    items: [
      ["4.1", "Check-in obligatoire 30 minutes avant le match."],
      ["4.2", "Au-delà de 15 minutes de retard, l’équipe présente peut réclamer la victoire par forfait."],
      ["4.3", "Trois forfaits dans un split entraînent l’exclusion du roster jusqu’au split suivant."],
    ],
  },
  {
    title: "Résultats et preuves",
    items: [
      ["5.1", "Le capitaine gagnant envoie la capture de fin de partie dans le Match Center. L’adversaire confirme sous 24 h."],
      ["5.2", "Un résultat n’est officiel qu’après validation, automatique ou par un arbitre."],
      ["5.3", "Toute contestation doit être motivée et accompagnée d’une preuve (capture, vidéo, extrait de chat)."],
    ],
  },
  {
    title: "Comportement et sanctions",
    items: [
      ["6.1", "Les propos insultants, discriminatoires ou menaçants dans le chat de match ou les messages privés sont sanctionnés."],
      ["6.2", "Barème : avertissement, carton jaune (−20 pts), carton rouge (suspension 7 jours), exclusion."],
      ["6.3", "La triche, le smurfing et le partage de compte entraînent l’exclusion de la saison."],
    ],
  },
];

export const RULES_GAME: Record<string, { title: string; items: [string, string][] }> = {
  val: { title: "Valorant · format et veto", items: [["V.1", "Séries BO3, BO5 en finale des Playoffs. Pool de 7 cartes annoncé en début de split."], ["V.2", "Veto : A bannit, B bannit, A choisit, B choisit côté, B choisit, A choisit côté, carte décisive restante."], ["V.3", "Pause technique : 10 minutes maximum par équipe et par carte."]] },
  cod: { title: "Call of Duty CDL · modes et veto", items: [["C.1", "Séries BO5 : Hardpoint, Recherche & Destruction, Contrôle, Hardpoint, Recherche & Destruction."], ["C.2", "Chaque mode a son propre pool de cartes. Les bannissements se font mode par mode."], ["C.3", "Restrictions d’armes et d’atouts selon la liste CDL en vigueur."]] },
  rl: { title: "Rocket League · format", items: [["R.1", "Séries BO5, BO7 en finale. Mode Standard 3v3, terrain DFH Stadium par défaut."], ["R.2", "Le lobby est créé par l’équipe la mieux classée et communiqué dans le chat de match."], ["R.3", "Une déconnexion avant le premier but permet de relancer la manche."]] },
  fc: { title: "EA Sports FC 27 · format", items: [["F.1", "Match aller simple, mode FUT. Durée de mi-temps : 6 minutes."], ["F.2", "En cas d’égalité : prolongation puis tirs au but."], ["F.3", "Équipes FUT libres dans le respect des cartes disponibles en jeu."]] },
  tek: { title: "Tekken 8 · format", items: [["T.1", "Sets FT3, finale des Playoffs en FT5. 3 rounds gagnants par manche."], ["T.2", "Le perdant d’une manche peut changer de personnage. Le vainqueur garde le sien."], ["T.3", "Choix de scène libre, scène aléatoire en cas de désaccord."]] },
  tft: { title: "TFT · rendez-vous mensuels", items: [["L.1", "6 manches, lobbys de 8 joueurs. Points : 8 pour le 1er à 1 pour le 8e."], ["L.2", "Les lobbys sont recomposés après chaque manche selon le classement cumulé."], ["L.3", "Départage : nombre de Top 4, puis meilleure place sur une manche."]] },
  wz: { title: "Warzone · rendez-vous mensuels", items: [["W.1", "6 manches en duo, 1 lobby de 24 duos maximum."], ["W.2", "Points : placement (15 pour le 1er) + 1 point par élimination."], ["W.3", "Le code du lobby privé est communiqué 15 minutes avant chaque manche."]] },
  apex: { title: "Apex Legends · rendez-vous mensuels", items: [["A.1", "6 manches en trio, 1 lobby de 20 trios maximum."], ["A.2", "Points : placement (12 pour le 1er) + 1 point par élimination."], ["A.3", "Cartes de la rotation annoncées dans le règlement du mois."]] },
};

export const GUIDE: Record<string, { label: string; blocks: { t: string; d: string; cta?: [string, string] }[] }> = {
  joueurs: {
    label: "Joueurs & équipes",
    blocks: [
      { t: "Inscription", d: "Ouverte toute l’année. Créez votre profil, liez votre compte de jeu, choisissez le jeu et le format, acceptez le règlement et déclarez votre roster (titulaires + 2 remplaçants).", cta: ["S’inscrire", "/inscription"] },
      { t: "Season 1 · placement (janvier → février)", d: "5 matchs de placement contre des niveaux variés, avec des gains et pertes de points accélérés. Après 2 victoires d’affilée, vous pouvez défier jusqu’à 8 rangs au-dessus." },
      { t: "Défis", d: "Vous pouvez défier jusqu’à 2 rangs au-dessus et 1 en dessous. Proposez 3 créneaux, l’adversaire en choisit un sous 48 h, le match se joue sous 7 jours. Pas de revanche avant 14 jours.", cta: ["Centre des défis", "/rankings/defis"] },
      { t: "Résultats", d: "Envoyez la capture de fin de match : le score est lu automatiquement, puis l’adversaire confirme sous 24 h. Les points ne bougent qu’une fois le résultat validé." },
      { t: "Divisions & splits", d: "Divisions de 8. Split 1 de mars à mai, mercato en juin, Split 2 de juillet à septembre. Les 2 premiers montent, les 2 derniers descendent." },
      { t: "Playoffs & cashprize", d: "Le top 8 de la Division 1 au 30 septembre dispute les Playoffs en octobre et novembre, finale en LAN. 2 500 € de cashprize.", cta: ["Playoffs", "/playoffs"] },
      { t: "Fair-play", d: "Refus de défi sans motif : forfait et −40 pts. Inactivité au-delà de 14 jours (équipes) ou 7 jours (1v1) : avertissement puis pénalités. 14 jours de congé par an sans pénalité." },
    ],
  },
  spectateurs: {
    label: "Spectateurs",
    blocks: [
      { t: "Suivre le classement", d: "RushXP Rankings se met à jour après chaque match validé. Filtrez par jeu, division ou recherchez votre équipe.", cta: ["Voir les Rankings", "/rankings"] },
      { t: "Regarder les matchs", d: "Le Match Center affiche le score, le veto et les liens Twitch, Kick ou YouTube de chaque rencontre.", cta: ["Matchs du jour", "/calendrier"] },
      { t: "Les temps forts", d: "Fin février : première répartition. 31 mai et 30 septembre : montées et descentes. Octobre → novembre : Playoffs et finale LAN." },
      { t: "Actualités & sondages", d: "Résultats, annonces officielles, vidéos et sondages de la communauté.", cta: ["Fil d’actualité", "/actualites"] },
    ],
  },
  partenaires: {
    label: "Partenaires",
    blocks: [
      { t: "Une audience toute l’année", d: "Le classement permanent génère des matchs chaque semaine, pas seulement pendant un tournoi." },
      { t: "Des emplacements identifiés", d: "Bannière d’accueil, carte sponsorisée dans le fil, bandeau de compétition, bloc latéral, visuel événementiel. Chaque publicité porte un label visible." },
      { t: "Les Playoffs et la LAN", d: "Octobre → novembre : pic d’audience, finale en présentiel, naming possible du cashprize." },
      { t: "Des chiffres suivis", d: "Impressions, clics et taux de clic par campagne, consultables dans votre espace.", cta: ["Devenir partenaire", "/partenaires#devenir-partenaire"] },
    ],
  },
  faq: {
    label: "Questions fréquentes",
    blocks: [
      { t: "Faut-il attendre une saison pour s’inscrire ?", d: "Non. Les inscriptions sont ouvertes toute l’année ; vous entrez en placement avec un score provisoire." },
      { t: "Tous les matchs comptent-ils ?", d: "Oui. Chaque match joué et validé sur RushXP (défi, appariement automatique ou Playoffs) fait évoluer RushXP Rankings et donc le classement général des structures." },
      { t: "Comment sont choisis les qualifiés des Playoffs ?", d: "Le seeding officiel du 30 septembre est figé : les 8 premiers de la Division 1 sont qualifiés, 1er contre 8e, 2e contre 7e, etc." },
      { t: "Que se passe-t-il si l’adversaire conteste ?", d: "Le résultat est suspendu et un arbitre tranche à partir des preuves. Aucun point n’est versé avant la décision." },
      { t: "Puis-je changer de joueurs ?", d: "Oui, pendant le mercato de juin et dans la limite de 2 arrivées par roster en cours de split, après validation RushXP." },
      { t: "Qui touche le cashprize ?", d: "Les 2 500 € sont réservés au top de la Division 1 en Playoffs. La répartition est publiée dans le règlement." },
    ],
  },
};

/** Partenaires fournis par le client (logos dans public/assets). */
export const PARTNERS = [
  { id: "mcdo", name: "McDonald’s", cat: "Restauration", logo: "/assets/partner-mcdo.png", desc: "Partenaire restauration de la saison. Campagne McDelivery diffusée dans le fil et lors des soirées de finale." },
  { id: "orange", name: "Orange", cat: "Télécom & connectivité", logo: "/assets/partner-orange.png", desc: "Partenaire connectivité. Présente les Playoffs et la connexion des LAN RushXP." },
  { id: "ocorner", name: "OCorner", cat: "Lieu gaming & événementiel", logo: "/assets/partner-ocorner.png", desc: "Lieu d’accueil des LAN et des finales en présentiel." },
  { id: "easygym", name: "easyGym", cat: "Sport & bien-être", logo: "/assets/partner-easygym.png", desc: "Partenaire préparation physique des joueurs et des structures." },
  { id: "saintpaul", name: "Ville de Saint-Paul", cat: "Partenaire institutionnel", logo: "/assets/partner-saintpaul.png", desc: "Collectivité partenaire de la saison RushXP · Île de La Réunion." },
];

export const AD_SLOTS: [string, string][] = [
  ["Bannière d’accueil", "Haut de page, toutes les visites"],
  ["Carte sponsorisée", "Dans le fil d’actualité, label visible"],
  ["Bandeau de compétition", "Sur une page de jeu ou les Playoffs"],
  ["Bloc latéral", "Pages classement et structure"],
  ["Visuel événementiel", "Finale LAN, diffusion, réseaux"],
];

export const SEASON_PEAKS: [string, string, string, string][] = [
  ["Janv. → févr.", "Season 1", "placement et inscriptions", "Moyen"],
  ["31 mai · 30 sept.", "Fins de split", "montées et descentes", "Fort"],
  ["Juin", "Mercato", "transferts et annonces", "Moyen"],
  ["Oct. → nov.", "Playoffs & finale LAN", "2 500 € de cashprize", "Très fort"],
];

/** Formats des rendez-vous mensuels (jeux en lobby). */
export const EVENT_FORMATS: Record<"tft" | "wz" | "apex", { fmt: string; cap: number; unit: string; size: number; checkIn: string; rules: [string, string][] }> = {
  tft: { fmt: "Solo · lobbys de 8", cap: 32, unit: "joueurs", size: 1, checkIn: "17:15", rules: [["6 manches", "une soirée, environ 4 h 30 de jeu"], ["4 lobbys de 8", "32 joueurs maximum"], ["Lobbys recomposés", "après chaque manche, selon le classement cumulé : les 8 premiers jouent ensemble, puis les 8 suivants, etc."], ["Départage", "nombre de Top 4, puis meilleure place sur une manche"]] },
  wz: { fmt: "Duo · 1 lobby", cap: 24, unit: "duos", size: 2, checkIn: "19:15", rules: [["6 manches", "une soirée, parties privées en Résurgence ou Battle Royale selon le règlement"], ["1 lobby", "24 duos maximum"], ["Points", "placement + 1 point par élimination"], ["Départage", "nombre de victoires, puis total d’éliminations"]] },
  apex: { fmt: "Trio · 1 lobby", cap: 20, unit: "trios", size: 3, checkIn: "19:15", rules: [["6 manches", "une soirée, cartes annoncées dans le règlement"], ["1 lobby", "20 trios maximum"], ["Points", "placement + 1 point par élimination"], ["Départage", "nombre de victoires, puis meilleur placement moyen"]] },
};

export const SYSTEM_STATES: Record<string, { code: string; tone: "orange" | "yellow" | "red" | "silver"; title: string; text: string; primary: [string, string]; secondary?: [string, string] }> = {
  maintenance: { code: "MAJ", tone: "yellow", title: "Maintenance en cours", text: "RushXP est en maintenance programmée. Les matchs prévus pendant ce créneau sont décalés automatiquement, sans pénalité.", primary: ["Retour à l’accueil", "/"] },
  suspendu: { code: "STOP", tone: "red", title: "Compte suspendu", text: "Votre compte est suspendu suite à une décision d’arbitrage. Vous ne pouvez plus vous connecter pendant la durée de la sanction. Un appel est possible sous 48 h.", primary: ["Lire le règlement", "/reglement"], secondary: ["Contacter RushXP", "mailto:contact@rushxp.re"] },
  "connexion-perdue": { code: "—", tone: "silver", title: "Connexion perdue", text: "Impossible de joindre le serveur. Vos actions en cours (veto, chat, résultat) sont conservées et seront envoyées au retour de la connexion.", primary: ["Réessayer", "/"] },
};

export const BADGES: [string, string, string, number][] = [
  ["MVP", "Premier MVP", "Être élu MVP d’un match", 50],
  ["×10", "Série de 10", "Gagner 10 matchs classés", 150],
  ["D1", "Division 1", "Atteindre la Division 1 RushXP Rankings", 200],
  ["RDV", "Habitué", "Jouer 3 rendez-vous mensuels", 100],
  ["XP", "Niveau 25", "Atteindre le niveau XP 25", 250],
  ["PO", "Playoffs", "Se qualifier pour les Playoffs", 300],
  ["1ER", "Champion", "Remporter les Playoffs d’un jeu", 500],
  ["MG", "Multigaming", "Jouer des matchs classés sur 3 jeux", 120],
];
