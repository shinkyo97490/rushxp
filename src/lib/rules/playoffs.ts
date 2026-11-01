/** Tableau des Playoffs : 8 qualifiés, élimination directe (SPEC_METIER §6). Fonctions pures. */

export const PLAYOFF_SIZE = 8;
/** Quarts : 1 contre 8, 4 contre 5, 2 contre 7, 3 contre 6 (les têtes de série 1 et 2 ne se croisent qu'en finale). */
export const QF_PAIRS: [number, number][] = [[1, 8], [4, 5], [2, 7], [3, 6]];

export const ROUND_LABEL: Record<string, string> = {
  QF1: "Quart de finale 1",
  QF2: "Quart de finale 2",
  QF3: "Quart de finale 3",
  QF4: "Quart de finale 4",
  SF1: "Demi-finale 1",
  SF2: "Demi-finale 2",
  F: "Finale",
};

const NEXT: Record<string, { round: string; from: [string, string] }> = {
  QF1: { round: "SF1", from: ["QF1", "QF2"] },
  QF2: { round: "SF1", from: ["QF1", "QF2"] },
  QF3: { round: "SF2", from: ["QF3", "QF4"] },
  QF4: { round: "SF2", from: ["QF3", "QF4"] },
  SF1: { round: "F", from: ["SF1", "SF2"] },
  SF2: { round: "F", from: ["SF1", "SF2"] },
};

export function nextRound(round: string): { round: string; from: [string, string]; label: string } | null {
  const n = NEXT[round];
  return n ? { ...n, label: ROUND_LABEL[n.round] } : null;
}

export interface SeedRow {
  seed: number;
  entityId: string;
  name: string;
  score: number;
}

/** Qualifiés : les 8 premiers hors placement, dans l'ordre du classement. */
export function qualifiers(rows: { id: string; name: string; team?: string; score: number; inPlacement: boolean }[]): SeedRow[] {
  return rows
    .filter((r) => !r.inPlacement)
    .slice(0, PLAYOFF_SIZE)
    .map((r, i) => ({ seed: i + 1, entityId: r.id, name: r.team ? `${r.name} · ${r.team}` : r.name, score: r.score }));
}

/** Quarts de finale à partir des têtes de série (null si moins de 8 qualifiés pour une paire). */
export function quarterFinals(seeds: SeedRow[]) {
  return QF_PAIRS.map(([x, y], i) => ({ round: `QF${i + 1}`, a: seeds.find((s) => s.seed === x) ?? null, b: seeds.find((s) => s.seed === y) ?? null }));
}
