/** Application d'un résultat et inactivité (SPEC_METIER §6). Fonctions pures, testées. */

import { countsForRanking } from "./challenge";
import { eloDelta, type Rated } from "./elo";

export const IMMUNITY_HOURS = 72;
export const CONFIRM_HOURS = 24;
export const REMIND_HOURS = 24;
const DAY = 86_400_000;

export interface MatchOutcome {
  counted: boolean;
  deltaA: number;
  deltaB: number;
}

/** Variations Elo des deux camps ; 0 si la paire a déjà 2 matchs comptés sur 30 jours glissants. */
export function resolveMatch(a: Rated, b: Rated, aWon: boolean, countedPairDates: Date[], now: Date): MatchOutcome {
  if (!countsForRanking(countedPairDates, now)) return { counted: false, deltaA: 0, deltaB: 0 };
  return { counted: true, deltaA: eloDelta(a, b, aWon ? 1 : 0), deltaB: eloDelta(b, a, aWon ? 0 : 1) };
}

/** Rangs par score décroissant (égalité : ordre d'inscription). */
export function rankOf<T extends { score: number; createdAt: Date }>(entries: T[]): Map<T, number> {
  const sorted = [...entries].sort((x, y) => y.score - x.score || x.createdAt.getTime() - y.createdAt.getTime());
  return new Map(sorted.map((e, i) => [e, i + 1]));
}

/**
 * Inactivité : seuil 7 j (1v1) ou 14 j (équipes). Avertissement de seuil+1 à seuil+7, puis −20 (palier 1),
 * −20 (palier 2) et −40 avec statut inactif (palier 3). Chaque palier ne s'applique qu'une fois.
 */
export function inactivityStep(daysSince: number, solo: boolean, level: number): { level: number; penalty: number } {
  const lim = solo ? 7 : 14;
  const target = daysSince > lim + 21 ? 3 : daysSince > lim + 14 ? 2 : daysSince > lim + 7 ? 1 : 0;
  let penalty = 0;
  for (let l = level + 1; l <= target; l++) penalty += l === 3 ? 40 : 20;
  return { level: Math.max(level, target), penalty };
}

export function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY));
}

/** Scores possibles d'une série (vainqueur en premier). */
export function seriesScores(series: string | null | undefined): [number, number][] {
  const m = /^(BO|FT)(\d+)$/i.exec(series ?? "");
  if (!m) return [[1, 0]];
  const win = m[1].toUpperCase() === "BO" ? Math.ceil(Number(m[2]) / 2) : Number(m[2]);
  return Array.from({ length: win }, (_, l) => [win, l] as [number, number]);
}
