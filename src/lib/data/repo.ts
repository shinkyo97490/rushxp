/**
 * Accès aux données. Aujourd'hui : données de démonstration.
 * Demain : requêtes Prisma (RankingEntry, Roster, Structure…) avec la même signature.
 */

import { structureStandings, type RankedRoster } from "@/lib/rules/standings";
import { LOBBY_SEASON, RANKINGS, STRUCTURES, meEntryId, type DemoEntry } from "./demo";
import { CHALLENGE_GAMES, type ChallengeGameId } from "./games";

export const DIVISION_SIZE = 8;

export interface RankingRow extends DemoEntry {
  rank: number;
  division: number;
  isMe: boolean;
  inPlacement: boolean;
}

export function getRankings(game: ChallengeGameId): RankingRow[] {
  const list = [...RANKINGS[game]].sort((a, b) => b.score - a.score);
  const nDiv = Math.max(1, Math.ceil(list.length / DIVISION_SIZE));
  const me = meEntryId(game);
  return list.map((e, i) => {
    const inPlacement = e.placementMatches < 5;
    return {
      ...e,
      rank: i + 1,
      division: inPlacement ? nDiv : Math.min(nDiv, Math.floor(i / DIVISION_SIZE) + 1),
      isMe: e.id === me,
      inPlacement,
    };
  });
}

export function getStructure(id: string) {
  return STRUCTURES.find((s) => s.id === id);
}

export function getStructureStandings() {
  const rosters: RankedRoster[] = [];
  for (const g of CHALLENGE_GAMES) {
    for (const r of getRankings(g.id as ChallengeGameId)) {
      rosters.push({ game: g.id, rank: r.rank, structureId: r.structureId, inPlacement: r.inPlacement });
    }
  }
  for (const [game, rows] of Object.entries(LOBBY_SEASON)) {
    [...rows]
      .sort((a, b) => b.points - a.points)
      .forEach((row, i) => rosters.push({ game, rank: i + 1, structureId: row.structureId }));
  }
  return structureStandings(rosters).map((s) => ({ ...s, structure: getStructure(s.structureId)! }));
}
