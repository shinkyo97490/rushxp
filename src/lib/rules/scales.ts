/** Barèmes : classement général des structures et RDV mensuels (SPEC_METIER §6). */

const STRUCTURE_SCALE = [100, 90, 82, 75, 69, 64, 60, 56];
const STRUCTURE_STEP = 4;
const STRUCTURE_MIN = 5;

/** Points au classement général selon le rang d'un roster dans les Rankings d'un jeu. */
export function structurePoints(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1) throw new RangeError(`rang invalide : ${rank}`);
  if (rank <= STRUCTURE_SCALE.length) return STRUCTURE_SCALE[rank - 1];
  const last = STRUCTURE_SCALE[STRUCTURE_SCALE.length - 1];
  return Math.max(STRUCTURE_MIN, last - STRUCTURE_STEP * (rank - STRUCTURE_SCALE.length));
}

export interface LobbyScale {
  placement: number[];
  pointPerKill: number;
}

/** Valeurs par défaut ; en production, elles sont lues sur Game.scale (paramètre admin). */
export const LOBBY_SCALES: Record<"tft" | "wz" | "apex", LobbyScale> = {
  tft: { placement: [8, 7, 6, 5, 4, 3, 2, 1], pointPerKill: 0 },
  wz: { placement: [15, 12, 10, 8, 6, 5, 4, 3, 2, 1], pointPerKill: 1 },
  apex: { placement: [12, 9, 7, 5, 4, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1], pointPerKill: 1 },
};

export function lobbyPoints(scale: LobbyScale, placement: number, kills = 0): number {
  if (!Number.isInteger(placement) || placement < 1) throw new RangeError(`place invalide : ${placement}`);
  return (scale.placement[placement - 1] ?? 0) + scale.pointPerKill * Math.max(0, kills);
}

/** Bonus des LAN (décision du 30 oct. 2026) : barème des Rankings + 50 points par rang final. */
export const LAN_BONUS = 50;

/** Points au classement général selon le rang final d'une structure dans une LAN. */
export function lanPoints(rank: number): number {
  return structurePoints(rank) + LAN_BONUS;
}

/** Rangs affichés sur la page LAN (1er → 8e). */
export const LAN_SCALE_PREVIEW: [string, number][] = [
  ["1er", lanPoints(1)],
  ["2e", lanPoints(2)],
  ["3e", lanPoints(3)],
  ["4e", lanPoints(4)],
  ["5e", lanPoints(5)],
  ["8e", lanPoints(8)],
];

/**
 * Points LAN d'une structure : par jeu, seul son meilleur classement compte (un joueur solo rapporte
 * ses points à sa structure), puis on additionne les jeux.
 */
export function lanStructurePoints(rows: { game: string; place: number; structure: string | null }[]) {
  const best = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!r.structure) continue;
    const pts = lanPoints(r.place);
    const g = best.get(r.structure) ?? new Map<string, number>();
    if ((g.get(r.game) ?? 0) < pts) g.set(r.game, pts);
    best.set(r.structure, g);
  }
  return [...best.entries()]
    .map(([structure, g]) => ({ structure, points: [...g.values()].reduce((a, b) => a + b, 0), byGame: Object.fromEntries(g) }))
    .sort((a, b) => b.points - a.points || a.structure.localeCompare(b.structure));
}
