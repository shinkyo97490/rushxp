/**
 * Données de DÉMONSTRATION, générées de façon déterministe.
 * Noms neutres et fictifs : à remplacer par les données réelles (Prisma) — voir repo.ts.
 */

import { CHALLENGE_GAMES, type ChallengeGameId } from "./games";

export interface DemoStructure {
  id: string;
  name: string;
  tag: string;
}

export const STRUCTURES: DemoStructure[] = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel",
  "India", "Juliett", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa",
].map((n) => ({ id: n.toLowerCase(), name: `${n} Esport`, tag: n.slice(0, 3).toUpperCase() }));

/** Structure de l'utilisateur de démonstration. */
export const ME_STRUCTURE = "alpha";

export interface DemoEntry {
  id: string; // roster (équipe) ou joueur (1v1)
  name: string;
  team?: string; // nom d'équipe secondaire ou structure du joueur
  structureId: string;
  score: number;
  prevRank: number;
  placementMatches: number;
  wins: number;
  losses: number;
  daysSinceMatch: number;
  rosterComplete: boolean;
}

const PSEUDOS = ["Akio", "Bastet", "Cyra", "Dorn", "Elko", "Fenn", "Gaïa", "Hiro", "Isko", "Jory", "Kato", "Lumi", "Miro", "Nalu", "Opal", "Pika", "Quin", "Rawi", "Selo", "Tiko"];

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildGame(gameId: ChallengeGameId, seed: number): DemoEntry[] {
  const solo = gameId === "fc" || gameId === "tek";
  const r = rng(seed);
  const entries: DemoEntry[] = [];
  const count = solo ? 20 : 14;
  for (let i = 0; i < count; i++) {
    const s = STRUCTURES[i % STRUCTURES.length];
    const placement = i >= count - 2;
    entries.push({
      id: `${gameId}-${i}`,
      name: solo ? PSEUDOS[i % PSEUDOS.length] : s.name,
      team: solo ? s.name : undefined,
      structureId: s.id,
      score: placement ? 800 + Math.round(r() * 60) : 1050 + Math.round(r() * 650),
      prevRank: 0,
      placementMatches: placement ? 1 + Math.floor(r() * 3) : 5 + Math.floor(r() * 20),
      wins: Math.floor(r() * 14),
      losses: Math.floor(r() * 10),
      daysSinceMatch: Math.floor(r() * (solo ? 12 : 24)),
      rosterComplete: r() > 0.08,
    });
  }
  if (!solo) {
    // Plusieurs équipes par jeu : seconde équipe de la structure de démo.
    entries.push({
      id: `${gameId}-academy`, name: "Alpha Esport", team: "Équipe Academy", structureId: ME_STRUCTURE,
      score: 1180 + Math.round(r() * 80), prevRank: 0, placementMatches: 9, wins: 6, losses: 5, daysSinceMatch: 4, rosterComplete: true,
    });
  }
  entries.sort((a, b) => b.score - a.score);
  entries.forEach((e, i) => (e.prevRank = Math.max(1, i + 1 + Math.round((r() - 0.5) * 4))));
  return entries;
}

export const RANKINGS: Record<ChallengeGameId, DemoEntry[]> = Object.fromEntries(
  CHALLENGE_GAMES.map((g, i) => [g.id, buildGame(g.id as ChallengeGameId, 97 + i * 31)]),
) as Record<ChallengeGameId, DemoEntry[]>;

/** Entrée « vous » par jeu : roster principal de la structure de démo, ou joueur. */
export function meEntryId(game: ChallengeGameId): string {
  const list = RANKINGS[game];
  return (list.find((e) => e.structureId === ME_STRUCTURE && e.id !== `${game}-academy`) ?? list[0]).id;
}

/** Résultats cumulés des RDV mensuels : rang de chaque structure (jeux en lobby). */
export const LOBBY_SEASON: Record<"tft" | "wz" | "apex", { structureId: string; points: number }[]> = {
  tft: STRUCTURES.slice(0, 10).map((s, i) => ({ structureId: s.id, points: 120 - i * 9 - (i % 3) })),
  wz: STRUCTURES.slice(2, 12).map((s, i) => ({ structureId: s.id, points: 210 - i * 14 })),
  apex: STRUCTURES.slice(4, 13).map((s, i) => ({ structureId: s.id, points: 180 - i * 12 - (i % 2) * 3 })),
};
