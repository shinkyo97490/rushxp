/** Elo RushXP : K = 40 pendant les 5 matchs de placement, puis 32 (SPEC_METIER §6). */

export const PLACEMENT_MATCHES = 5;
export const K_PLACEMENT = 40;
export const K_DEFAULT = 32;
export const START_SCORE = 800;

export interface Rated {
  score: number;
  placementMatches: number;
}

export function kFactor(entry: Pick<Rated, "placementMatches">): number {
  return entry.placementMatches < PLACEMENT_MATCHES ? K_PLACEMENT : K_DEFAULT;
}

/** Probabilité de victoire de `a` contre `b`. */
export function expectedScore(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/** Variation de score de `a` pour un résultat (1 = victoire, 0 = défaite). */
export function eloDelta(a: Rated, b: Rated, result: 0 | 1): number {
  return Math.round(kFactor(a) * (result - expectedScore(a.score, b.score)));
}

/** Enjeux affichés AVANT d'agir sur un défi. */
export function stakes(me: Rated, opponent: Rated): { win: number; loss: number } {
  return { win: eloDelta(me, opponent, 1), loss: eloDelta(me, opponent, 0) };
}

export function formatDelta(v: number): string {
  return (v >= 0 ? "+" : "−") + Math.abs(v);
}
