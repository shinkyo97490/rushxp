/** Configuration des jeux. En production : table Game (formats paramétrables par l'admin). */

export type ChallengeGameId = "val" | "rl" | "cod" | "fc" | "tek";
export type LobbyGameId = "tft" | "wz" | "apex";
export type GameId = ChallengeGameId | LobbyGameId;

export interface GameConfig {
  id: GameId;
  name: string;
  short: string;
  logo: string;
  kind: "challenge" | "lobby";
  format: string; // "5v5", "Solo", "Duo"…
  rosterSize: number;
  series?: string;
}

export const GAMES: GameConfig[] = [
  { id: "val", name: "Valorant", short: "VAL", logo: "/assets/game-valorant.png", kind: "challenge", format: "5v5", rosterSize: 5, series: "BO3" },
  { id: "rl", name: "Rocket League", short: "RL", logo: "/assets/game-rl.png", kind: "challenge", format: "3v3", rosterSize: 3, series: "BO5" },
  { id: "cod", name: "Call of Duty CDL", short: "CDL", logo: "/assets/game-cod.png", kind: "challenge", format: "4v4", rosterSize: 4, series: "BO5" },
  { id: "fc", name: "EA Sports FC 27", short: "FC", logo: "/assets/game-fc27.png", kind: "challenge", format: "1v1", rosterSize: 1, series: "BO3" },
  { id: "tek", name: "Tekken 8", short: "TEK", logo: "/assets/game-tekken.png", kind: "challenge", format: "1v1", rosterSize: 1, series: "FT3" },
  { id: "tft", name: "Teamfight Tactics", short: "TFT", logo: "/assets/game-tft.png", kind: "lobby", format: "Solo", rosterSize: 1 },
  { id: "wz", name: "Warzone", short: "WZ", logo: "/assets/game-warzone.png", kind: "lobby", format: "Duo", rosterSize: 2 },
  { id: "apex", name: "Apex Legends", short: "APEX", logo: "/assets/game-apex.png", kind: "lobby", format: "Trio", rosterSize: 3 },
];

export const CHALLENGE_GAMES = GAMES.filter((g) => g.kind === "challenge");

export function getGame(id: string): GameConfig | undefined {
  return GAMES.find((g) => g.id === id);
}

export function isSolo(g: GameConfig) {
  return g.rosterSize === 1;
}
