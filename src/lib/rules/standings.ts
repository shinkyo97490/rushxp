/** Classement général des structures : somme des barèmes par jeu (SPEC_METIER §6). */

import { structurePoints } from "./scales";

export interface RankedRoster {
  game: string;
  rank: number;
  structureId: string;
  inPlacement?: boolean;
}

export interface StructureStanding {
  structureId: string;
  perGame: Record<string, { points: number; rank: number }>;
  total: number;
  rank: number;
  tied: boolean;
}

/**
 * Seul le roster le mieux classé d'une structure compte pour un jeu
 * (en 1v1 : le meilleur joueur de la structure). Les entrées en placement ne comptent pas.
 * Pour les jeux en lobby, passer le rang de la structure au cumul des RDV de la saison.
 */
export function structureStandings(rosters: RankedRoster[]): StructureStanding[] {
  const map = new Map<string, StructureStanding>();
  for (const r of rosters) {
    if (r.inPlacement) continue;
    const s = map.get(r.structureId) ?? { structureId: r.structureId, perGame: {}, total: 0, rank: 0, tied: false };
    const pts = structurePoints(r.rank);
    const cur = s.perGame[r.game];
    if (!cur || pts > cur.points) s.perGame[r.game] = { points: pts, rank: r.rank };
    map.set(r.structureId, s);
  }
  const list = [...map.values()];
  for (const s of list) s.total = Object.values(s.perGame).reduce((a, g) => a + g.points, 0);
  list.sort((a, b) => b.total - a.total || a.structureId.localeCompare(b.structureId));
  list.forEach((s, i) => {
    s.rank = i > 0 && s.total === list[i - 1].total ? list[i - 1].rank : i + 1;
  });
  for (const s of list) s.tied = list.some((o) => o !== s && o.total === s.total);
  return list;
}

export function rankLabel(s: Pick<StructureStanding, "rank" | "tied">): string {
  return s.tied ? `${s.rank}=` : String(s.rank);
}
