/** Détail d'une série (BO3, BO5, FT3…) : score de chaque partie / carte. Fonctions pures, testées. */
import { CDL_MODES, CDL_SLOTS, type CdlMode } from "./veto";

export interface GameScore {
  /** Carte jouée (Valorant, CDL) ; vide pour les autres jeux. */
  map?: string;
  /** Mode CDL (HP, SND, CTRL). */
  mode?: string;
  a: number;
  b: number;
}

/** Nombre de parties à gagner et nombre maximal de parties. */
export function seriesShape(series: string | null | undefined) {
  const m = /^(BO|FT)(\d+)$/i.exec(series ?? "");
  if (!m) return { toWin: 1, max: 1 };
  const n = Number(m[2]);
  return m[1].toUpperCase() === "BO" ? { toWin: Math.ceil(n / 2), max: n } : { toWin: n, max: 2 * n - 1 };
}

/** Unité du score d'une partie, selon le jeu. */
export function gameUnit(game: string) {
  return game === "val" ? "manches" : game === "rl" || game === "fc" ? "buts" : game === "tek" ? "rounds" : game === "cod" ? "points" : "points";
}

/** Libellé d'une partie : « Carte 2 · Bind », « Partie 3 »… */
export function gameLabel(game: string, i: number, g?: Pick<GameScore, "map" | "mode">) {
  const head = game === "val" || game === "cod" ? `Carte ${i + 1}` : game === "tek" ? `Manche ${i + 1}` : `Partie ${i + 1}`;
  const mode = g?.mode ? CDL_MODES[g.mode as CdlMode] ?? g.mode : "";
  return [head, g?.map, mode].filter(Boolean).join(" · ");
}

/** Mode imposé de la i-e carte en CDL. */
export function cdlModeAt(i: number): CdlMode | undefined {
  return CDL_SLOTS[i];
}

/**
 * Valide le détail d'une série et en déduit le score (parties gagnées A–B).
 * Chaque partie a un vainqueur ; la série s'arrête dès qu'un camp atteint le nombre de victoires requis.
 */
export function seriesFromGames(series: string | null | undefined, games: GameScore[]): { a: number; b: number } | { error: string } {
  const { toWin, max } = seriesShape(series);
  if (!Array.isArray(games) || games.length === 0) return { error: "Saisissez le score de chaque partie." };
  if (games.length > max) return { error: `Une série ${series} compte au plus ${max} parties.` };
  let a = 0;
  let b = 0;
  for (const [i, g] of games.entries()) {
    if (a === toWin || b === toWin) return { error: `La série est terminée avant la partie ${i + 1}.` };
    if (![g.a, g.b].every((x) => Number.isInteger(x) && x >= 0 && x <= 999)) return { error: `Partie ${i + 1} : score invalide.` };
    if (g.a === g.b) return { error: `Partie ${i + 1} : il faut un vainqueur (score après prolongation ou tirs au but).` };
    if (g.a > g.b) a++;
    else b++;
  }
  if (a !== toWin && b !== toWin) return { error: `Série incomplète : il faut ${toWin} partie(s) gagnée(s).` };
  return { a, b };
}

/** Nettoie un détail de série venu du client (types, longueurs). */
export function cleanGames(raw: unknown): GameScore[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 9).map((g) => {
    const x = (g ?? {}) as Record<string, unknown>;
    const out: GameScore = { a: Number(x.a), b: Number(x.b) };
    if (typeof x.map === "string" && x.map.trim()) out.map = x.map.trim().slice(0, 40);
    if (typeof x.mode === "string" && x.mode in CDL_MODES) out.mode = x.mode;
    return out;
  });
}

/** Lecture tolérante du champ JSON stocké. */
export function readGames(v: unknown): GameScore[] {
  return Array.isArray(v) ? (v as GameScore[]).filter((g) => g && typeof g.a === "number" && typeof g.b === "number") : [];
}

/** Inverse le point de vue (A ↔ B). */
export function swapGames(games: GameScore[]): GameScore[] {
  return games.map((g) => ({ ...g, a: g.b, b: g.a }));
}

/** Résumé partie par partie, vu d'un camp : « Ascent 13–9 · Bind 10–13 ». */
export function gamesLine(game: string, games: GameScore[], amA = true) {
  return (amA ? games : swapGames(games)).map((g, i) => `${g.map ?? gameLabel(game, i)} ${g.a}–${g.b}`).join(" · ");
}
