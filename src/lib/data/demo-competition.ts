/**
 * Données de DÉMONSTRATION des écrans de compétition (calendrier, Match Center, Playoffs,
 * RDV mensuels, MVP, file d'arbitrage). Générées à partir des noms neutres de demo.ts.
 * Elles seront remplacées par les tables Match, Challenge, EventRound, ResultSubmission.
 */

import { RANKINGS, STRUCTURES } from "./demo";
import { CHALLENGE_GAMES, type ChallengeGameId } from "./games";
import { LOBBY_SCALES, lobbyPoints } from "@/lib/rules/scales";

const DAY = 86_400_000;

function seeded(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

function at(daysFromToday: number, hour: number, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return new Date(d.getTime() + daysFromToday * DAY);
}

export function topOf(game: ChallengeGameId) {
  return [...RANKINGS[game]].filter((e) => e.placementMatches >= 5).sort((a, b) => b.score - a.score);
}

const label = (game: ChallengeGameId, i: number) => {
  const e = topOf(game)[i];
  if (!e) return "À déterminer";
  return e.team && (game === "fc" || game === "tek") ? `${e.name} (${STRUCTURES.find((s) => s.id === e.structureId)?.tag})` : e.name;
};

export interface DemoMatch {
  id: string;
  game: ChallengeGameId | "tft" | "wz" | "apex";
  a: string;
  b: string;
  when: Date;
  type: "Défi" | "Playoffs" | "RDV mensuel";
  state: "Programmé" | "Check-in" | "Veto en cours" | "En direct" | "Terminé";
  score?: string;
  comp: string;
  mine: boolean;
}

export function demoMatches(): DemoMatch[] {
  return [
    { id: "m1", game: "val", a: label("val", 2), b: label("val", 3), when: at(0, 20), type: "Défi", state: "Veto en cours", comp: "RushXP Rankings · Valorant", mine: true },
    { id: "m2", game: "rl", a: label("rl", 0), b: label("rl", 7), when: at(0, 21), type: "Playoffs", state: "Check-in", comp: "Playoffs · Rocket League · Quart", mine: false },
    { id: "m3", game: "fc", a: label("fc", 1), b: label("fc", 6), when: at(1, 19), type: "Playoffs", state: "Programmé", comp: "Playoffs · FC 27 · Quart", mine: false },
    { id: "m4", game: "tek", a: label("tek", 3), b: label("tek", 4), when: at(2, 20, 30), type: "Défi", state: "Programmé", comp: "RushXP Rankings · Tekken 8", mine: false },
    { id: "m5", game: "cod", a: label("cod", 0), b: label("cod", 3), when: at(3, 18), type: "Playoffs", state: "Programmé", comp: "Playoffs · CDL · Demi-finale", mine: true },
    { id: "m6", game: "tft", a: "RDV TFT", b: "32 joueurs", when: at(17, 18), type: "RDV mensuel", state: "Programmé", comp: "Rendez-vous mensuel · 6 manches", mine: false },
    { id: "m7", game: "val", a: label("val", 1), b: label("val", 5), when: at(-4, 20), type: "Défi", state: "Terminé", score: "2–0", comp: "RushXP Rankings · Valorant", mine: false },
    { id: "m8", game: "cod", a: label("cod", 2), b: label("cod", 1), when: at(-3, 19), type: "Playoffs", state: "Terminé", score: "3–1", comp: "Playoffs · CDL · Quart", mine: true },
  ];
}

export const DEMO_RESULTS = [
  { id: "M-2041", game: "val", match: `${label("val", 2)} vs ${label("val", 3)}`, comp: "Valorant · défi", score: "13–9", src: "OCR · 94 %", st: "confirm" },
  { id: "M-2038", game: "fc", match: `${label("fc", 1)} vs ${label("fc", 6)}`, comp: "FC 27 · Playoffs", score: "2–1", src: "OCR · 97 %", st: "confirm" },
  { id: "M-2035", game: "cod", match: `${label("cod", 0)} vs ${label("cod", 4)}`, comp: "CDL · Quart", score: "3–2", src: "OCR · 58 %", st: "review" },
  { id: "M-2033", game: "rl", match: `${label("rl", 2)} vs ${label("rl", 5)}`, comp: "Rocket League · défi", score: "3–1", src: "Saisie manuelle", st: "contested" },
  { id: "M-2029", game: "val", match: `${label("val", 1)} vs ${label("val", 5)}`, comp: "Valorant · défi", score: "2–0", src: "OCR · 99 %", st: "auto" },
  { id: "M-2024", game: "rl", match: `${label("rl", 6)} vs ${label("rl", 8)}`, comp: "Rocket League · défi", score: "2–3", src: "Arbitre", st: "done" },
] as const;

export const RESULT_STATUS: Record<string, [string, string]> = {
  confirm: ["Confirmation nécessaire", "text-silver"],
  review: ["En vérification", "text-orange"],
  contested: ["Contesté", "text-red"],
  auto: ["Validé auto", "text-ink"],
  done: ["Terminé", "text-grey"],
};

export interface RefereeCase {
  id: string;
  type: "contest" | "ocr" | "ev";
  game: string;
  prio: "URGENT" | "HAUTE" | "NORMALE";
  age: string;
  title: string;
  comp: string;
  img?: string;
  file: string;
  why: string;
  cmp: [string, string, boolean][];
  chat: [string, string, string][];
  acts: string[];
}

export function demoRefereeQueue(): RefereeCase[] {
  const a = label("val", 2), b = label("val", 3), c = label("cod", 0), d = label("cod", 4);
  return [
    {
      id: "C-118", type: "contest", game: "val", prio: "URGENT", age: "il y a 35 min", title: `${a} vs ${b}`, comp: "RushXP Rankings · Valorant", img: "/assets/ocr-valorant.jpg", file: "capture_fin_carte2.jpg",
      why: `${b} conteste le score de la carte 2 : un joueur de ${a} aurait été remplacé en cours de partie par un joueur hors roster.`,
      cmp: [["Score lu (capture)", "13 – 11", false], [`Déclaré par ${a}`, "13 – 11", false], [`Déclaré par ${b}`, "Carte à rejouer", true], ["Joueur signalé", "remplaçant déclaré le 12 oct.", false]],
      chat: [["Système", "20:41", `Résultat soumis par ${a} : 2 – 0`], ["Capitaine " + b, "20:44", "On conteste la carte 2, le remplaçant n’était pas dans le roster de départ"], ["Capitaine " + a, "20:45", "Il est déclaré remplaçant depuis le 12 oct."]],
      acts: [`Valider 2 – 0 pour ${a}`, "Faire rejouer la carte 2", `Sanction · avertissement ${b}`],
    },
    {
      id: "O-342", type: "ocr", game: "cod", prio: "HAUTE", age: "il y a 1 h", title: `${c} vs ${d}`, comp: "RushXP Rankings · CDL", file: "hardpoint_final.png",
      why: "Lecture automatique incertaine (confiance 61 %) : le score Hardpoint est partiellement masqué par une notification.",
      cmp: [["Score lu", "250 – 2?7", true], [`Déclaré par ${c}`, "250 – 217", false], [`Déclaré par ${d}`, "250 – 217", false]],
      chat: [["Système", "19:58", `Capture envoyée par ${c}`], ["Système", "19:58", "Analyse : confiance faible, contrôle arbitre demandé"]],
      acts: ["Valider 250 – 217", "Demander une nouvelle capture"],
    },
    {
      id: "E-077", type: "ev", game: "tft", prio: "NORMALE", age: "hier", title: "RDV TFT · manche 4, lobby B", comp: "Rendez-vous mensuel", file: "lobbyB_m4.png",
      why: "Deux joueurs déclarent la même place (3e) dans le lobby B de la manche 4.",
      cmp: [["Joueur 1", "3e déclaré", true], ["Joueur 2", "3e déclaré", true], ["Lecture capture", "Joueur 1 3e · Joueur 2 4e", false]],
      chat: [["Système", "22:14", "Placements du lobby B soumis"], ["Joueur 2", "22:16", "J’étais 3e, l’autre joueur est sorti avant moi"]],
      acts: ["Valider la capture", "Valider la déclaration du joueur 2"],
    },
  ];
}

export const DEMO_CAMPAIGNS = [
  { name: "Lancement saison", partner: "Orange", slot: "Bannière d’accueil", dates: "20 oct. – 10 nov.", imp: 48210, clicks: 1302, cap: "150 000", status: "Active" },
  { name: "Playoffs", partner: "Orange", slot: "Bandeau de compétition", dates: "25 oct. – 8 nov.", imp: 21540, clicks: 775, cap: "80 000", status: "Active" },
  { name: "McDelivery · soirées de match", partner: "McDonald’s", slot: "Carte sponsorisée (fil)", dates: "1 – 30 oct.", imp: 63900, clicks: 1150, cap: "60 000", status: "Plafond atteint" },
];

// ─── Playoffs ────────────────────────────────────────────────────

export interface BracketSide {
  seed: number | null;
  name: string;
  score?: number;
  win?: boolean;
}
export interface BracketMatch {
  when: string;
  state: string;
  sides: [BracketSide, BracketSide];
}

export function playoffBracket(game: ChallengeGameId) {
  const top = topOf(game).slice(0, 8);
  const nm = (i: number) => (top[i] ? label(game, i) : "À déterminer");
  const pairs: [number, number][] = [[0, 7], [3, 4], [1, 6], [2, 5]];
  const results: ([number, number] | null)[] = [[2, 0], [1, 2], null, null];
  const fmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const qf: BracketMatch[] = pairs.map(([a, b], i) => {
    const r = results[i];
    return {
      when: r ? fmt.format(at(-10, 20)) : `${fmt.format(at(i, 20))} · 20:00`,
      state: r ? "Terminé" : "Programmé",
      sides: [
        { seed: a + 1, name: nm(a), score: r?.[0], win: r ? r[0] > r[1] : undefined },
        { seed: b + 1, name: nm(b), score: r?.[1], win: r ? r[1] > r[0] : undefined },
      ],
    };
  });
  const w = (m: BracketMatch) => m.sides.find((s) => s.win) ?? null;
  const sf: BracketMatch[] = [
    { when: "Octobre · date à fixer", state: "Programmé", sides: [w(qf[0]) ?? { seed: null, name: "Vainqueur QF1" }, w(qf[1]) ?? { seed: null, name: "Vainqueur QF2" }] },
    { when: "Octobre · date à fixer", state: "En attente", sides: [{ seed: null, name: "Vainqueur QF3" }, { seed: null, name: "Vainqueur QF4" }] },
  ].map((m) => ({ ...m, sides: m.sides.map((s) => ({ seed: s.seed, name: s.name })) as [BracketSide, BracketSide] }));
  const fi: BracketMatch[] = [{ when: "Finale LAN · nov. → déc.", state: "En attente", sides: [{ seed: null, name: "Vainqueur DF1" }, { seed: null, name: "Vainqueur DF2" }] }];
  const eliminated = new Set(qf.flatMap((m) => m.sides.filter((s) => s.win === false).map((s) => s.seed)));
  const inSemi = new Set(qf.flatMap((m) => m.sides.filter((s) => s.win).map((s) => s.seed)));
  const seeds = top.map((_, i) => ({ seed: i + 1, name: nm(i), state: eliminated.has(i + 1) ? "Éliminé" : inSemi.has(i + 1) ? "En demi-finale" : "En lice" }));
  return { qf, sf, fi, seeds };
}

// ─── Joueurs & MVP ───────────────────────────────────────────────

const PLAYER_POOL = ["Akio", "Bastet", "Cyra", "Dorn", "Elko", "Fenn", "Gaïa", "Hiro", "Isko", "Jory", "Kato", "Lumi", "Miro", "Nalu", "Opal", "Pika", "Quin", "Rawi", "Selo", "Tiko", "Uma", "Vaïa", "Wren", "Yoan"];

export function mvpRows(game: string) {
  const games = game === "all" ? [...CHALLENGE_GAMES.map((g) => g.id), "tft", "wz", "apex"] : [game];
  const rows = games.flatMap((g, gi) =>
    Array.from({ length: 6 }, (_, k) => {
      const r = seeded(gi * 97 + k * 13 + 7);
      const name = PLAYER_POOL[(gi * 6 + k * 5 + 3) % PLAYER_POOL.length];
      return { name, game: g, team: STRUCTURES[(gi * 3 + k) % STRUCTURES.length].name, mvp: 2 + Math.floor(r() * 9), matches: 10 + Math.floor(r() * 12), note: 6.2 + Math.floor(r() * 30) / 10 };
    }),
  );
  return rows.sort((a, b) => b.mvp - a.mvp || b.note - a.note).slice(0, game === "all" ? 20 : 12);
}

// ─── RDV mensuels ────────────────────────────────────────────────

export const EVENT_MONTHS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août"];
export const EVENT_DONE = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
/** Les 4 premiers mois sont la pré-saison : leurs RDV ne comptent pas au classement général. */
export const PRESEASON_MONTHS = 4;

export function eventStandings(game: "tft" | "wz" | "apex", month: number) {
  const scale = LOBBY_SCALES[game];
  const solo = game === "tft";
  const n = solo ? 32 : game === "wz" ? 20 : 18;
  const r = seeded(game.length * 1000 + month * 31 + 5);
  const entries = Array.from({ length: n }, (_, i) => ({
    name: solo ? `${PLAYER_POOL[i % PLAYER_POOL.length]}${i >= PLAYER_POOL.length ? " II" : ""}` : `${STRUCTURES[i % STRUCTURES.length].name}${i >= STRUCTURES.length ? " B" : ""}`,
    sub: solo ? STRUCTURES[(i * 5) % STRUCTURES.length].name : `${game === "wz" ? "duo" : "trio"}`,
    rounds: [] as { placement: number; kills: number; points: number }[],
  }));
  for (let round = 0; round < 6; round++) {
    // Placement : permutation pseudo-aléatoire, par lobby de 8 en TFT.
    const order = entries.map((_, i) => i).sort(() => r() - 0.5);
    order.forEach((idx, pos) => {
      const placement = solo ? (pos % 8) + 1 : pos + 1;
      const kills = solo ? 0 : Math.floor(r() * (placement <= 3 ? 9 : 5));
      entries[idx].rounds.push({ placement, kills, points: lobbyPoints(scale, placement, kills) });
    });
  }
  return entries
    .map((e) => ({ ...e, total: e.rounds.reduce((a, x) => a + x.points, 0), kills: e.rounds.reduce((a, x) => a + x.kills, 0), top4: e.rounds.filter((x) => x.placement <= 4).length }))
    .sort((a, b) => b.total - a.total || b.top4 - a.top4);
}
