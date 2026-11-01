/** Catalogue des succès RushXP et barème d'XP. Pur, partagé client / serveur. */

export type AchievementCategory = "debuts" | "competition" | "mvp" | "rdv" | "playoffs";

export interface AchievementDef {
  code: string;
  ico: string;
  title: string;
  desc: string;
  cat: AchievementCategory;
  max: number;
  xp: number;
}

export const ACHIEVEMENT_CATEGORIES: Record<AchievementCategory, string> = {
  debuts: "Premiers pas",
  competition: "Compétition",
  mvp: "MVP",
  rdv: "RDV mensuels & LAN",
  playoffs: "Playoffs",
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: "PROFILE", ico: "ID", title: "Carte d’identité", desc: "Renseigner sa bio et ses disponibilités", cat: "debuts", max: 1, xp: 25 },
  { code: "STRUCTURE", ico: "STR", title: "Recrue", desc: "Rejoindre une structure", cat: "debuts", max: 1, xp: 50 },
  { code: "CAPTAIN", ico: "C", title: "Brassard", desc: "Devenir capitaine d’une équipe", cat: "debuts", max: 1, xp: 75 },
  { code: "FIRST_MATCH", ico: "GO", title: "Premier match", desc: "Jouer un match officiel", cat: "debuts", max: 1, xp: 25 },
  { code: "FIRST_WIN", ico: "W", title: "Première victoire", desc: "Gagner un match officiel", cat: "debuts", max: 1, xp: 50 },

  { code: "MATCHES_25", ico: "25", title: "Assidu", desc: "Jouer 25 matchs officiels", cat: "competition", max: 25, xp: 150 },
  { code: "WINS_10", ico: "×10", title: "Série de 10", desc: "Gagner 10 matchs officiels", cat: "competition", max: 10, xp: 150 },
  { code: "WINS_50", ico: "×50", title: "Machine de guerre", desc: "Gagner 50 matchs officiels", cat: "competition", max: 50, xp: 400 },
  { code: "CHALLENGER", ico: "DÉF", title: "Provocateur", desc: "Lancer 5 défis RushXP Rankings", cat: "competition", max: 5, xp: 75 },
  { code: "SWEEP", ico: "2–0", title: "Balayage", desc: "Gagner une série sans perdre une seule partie", cat: "competition", max: 1, xp: 75 },
  { code: "COMEBACK", ico: "↺", title: "Remontada", desc: "Gagner une série après avoir perdu la première partie", cat: "competition", max: 1, xp: 150 },
  { code: "UPSET", ico: "⚡", title: "Exploit", desc: "Gagner un match classé qui rapporte au moins 25 points", cat: "competition", max: 1, xp: 150 },
  { code: "D1", ico: "D1", title: "Division 1", desc: "Atteindre la Division 1 des RushXP Rankings", cat: "competition", max: 1, xp: 200 },

  { code: "MVP_1", ico: "MVP", title: "Premier MVP", desc: "Être élu MVP d’un match", cat: "mvp", max: 1, xp: 50 },
  { code: "MVP_5", ico: "MVP5", title: "Patron", desc: "Être élu MVP de 5 matchs", cat: "mvp", max: 5, xp: 200 },
  { code: "MVP_15", ico: "GOAT", title: "Légende", desc: "Être élu MVP de 15 matchs", cat: "mvp", max: 15, xp: 500 },

  { code: "RDV_3", ico: "RDV", title: "Habitué", desc: "Jouer 3 rendez-vous mensuels", cat: "rdv", max: 3, xp: 100 },
  { code: "RDV_8", ico: "RDV8", title: "Fidèle", desc: "Jouer 8 rendez-vous mensuels", cat: "rdv", max: 8, xp: 250 },
  { code: "RDV_PODIUM", ico: "TOP3", title: "Podium", desc: "Finir dans le top 3 d’un rendez-vous mensuel", cat: "rdv", max: 1, xp: 200 },
  { code: "LAN_1", ico: "LAN", title: "En présentiel", desc: "Participer à une LAN RushXP", cat: "rdv", max: 1, xp: 150 },

  { code: "PLAYOFFS", ico: "PO", title: "Qualifié", desc: "Se qualifier pour les Playoffs", cat: "playoffs", max: 1, xp: 300 },
  { code: "FINALIST", ico: "F", title: "Finaliste", desc: "Atteindre une finale des Playoffs", cat: "playoffs", max: 1, xp: 400 },
  { code: "CHAMPION", ico: "★", title: "Champion", desc: "Remporter une finale des Playoffs", cat: "playoffs", max: 1, xp: 500 },
];

export const XP_PER_LEVEL = 250;

/** Niveau de profil : 1 + 1 niveau par tranche de 250 XP. */
export function levelFor(xp: number) {
  return 1 + Math.floor(Math.max(0, xp) / XP_PER_LEVEL);
}

/** Progression dans le niveau en cours. */
export function levelProgress(xp: number) {
  const level = levelFor(xp);
  const from = (level - 1) * XP_PER_LEVEL;
  return { level, cur: xp - from, need: XP_PER_LEVEL, next: level * XP_PER_LEVEL };
}
