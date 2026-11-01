/** Assemble le classement « vivant » (scores + défis) et le contexte d'éligibilité. Pur, utilisable client et serveur. */

import { challengeBlock, ineligibilityLabel, isZoneWidened, type ChallengeContext, type Ineligibility } from "@/lib/rules/challenge";
import { stakes } from "@/lib/rules/elo";
import type { ChallengeStatus } from "@/lib/rules/challenge";

export const DIVISION_SIZE = 8;

export interface RankingRow {
  id: string; // roster (équipe) ou joueur (1v1)
  name: string;
  team?: string; // nom d'équipe secondaire ou structure du joueur
  structureId: string;
  score: number;
  rank: number;
  prevRank: number;
  placementMatches: number;
  wins: number;
  losses: number;
  daysSinceMatch: number;
  rosterComplete: boolean;
  division: number;
  isMe: boolean;
  inPlacement: boolean;
  immuneUntil?: string | null;
}

export interface ChallengeItem {
  id: string;
  dir: "in" | "out";
  oppId: string;
  status: ChallengeStatus;
  origin: "manual" | "auto";
  meta: string;
  slots?: string[];
  slotIsos?: string[];
  slot?: string;
  slotIso?: string;
  result?: string;
  playedAt?: string; // ISO, pour la règle de revanche
  matchId?: string;
  canConfirm?: boolean; // l'adversaire a déclaré : à vous de confirmer ou contester
  canDeclare?: boolean;
  scores?: [number, number][];
}

const ACTIVE = new Set(["PENDING", "ACCEPTED", "PLANNED", "CHECK_IN", "LIVE", "SUBMITTED", "DISPUTED"]);

export interface Eligibility {
  ctx: ChallengeContext;
  widened: boolean;
  block: (id: string) => Ineligibility | null;
  why: (id: string) => string | null;
  stakesFor: (id: string) => { win: number; loss: number };
  pendingOut: number;
  received: number;
}

export function eligibility(rows: RankingRow[], challenges: ChallengeItem[], canAct: boolean, solo: boolean, now = new Date()): Eligibility {
  const me = rows.find((r) => r.isMe)!;
  const toContender = (r: RankingRow) => ({
    id: r.id,
    rank: r.rank,
    structureId: solo ? null : r.structureId, // en 1v1, deux joueurs d'une même structure peuvent s'affronter
    inPlacement: r.inPlacement,
    inactive: r.daysSinceMatch > (solo ? 7 : 14) + 21,
    immuneUntil: r.immuneUntil ? new Date(r.immuneUntil) : null,
    rosterComplete: r.rosterComplete,
  });
  const lastMatchWith = new Map<string, Date>();
  for (const c of challenges) if (c.playedAt) lastMatchWith.set(c.oppId, new Date(c.playedAt));
  const ctx: ChallengeContext = {
    me: toContender(me),
    all: rows.map(toContender),
    canAct,
    pendingOut: challenges.filter((c) => c.dir === "out" && c.status === "PENDING").length,
    busyWith: new Set(challenges.filter((c) => ACTIVE.has(c.status)).map((c) => c.oppId)),
    lastMatchWith,
    now,
  };
  const widened = isZoneWidened(ctx);
  const byId = new Map(ctx.all.map((c) => [c.id, c]));
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const block = (id: string) => challengeBlock(ctx, byId.get(id)!);
  return {
    ctx,
    widened,
    block,
    why: (id) => {
      const b = block(id);
      return b ? ineligibilityLabel(b, widened) : null;
    },
    stakesFor: (id) => stakes(me, rowById.get(id)!),
    pendingOut: ctx.pendingOut,
    received: challenges.filter((c) => c.dir === "in" && c.status === "PENDING").length,
  };
}

export function zoneText(widened: boolean) {
  return widened
    ? "Zone élargie : moins de 2 adversaires disponibles, vous pouvez défier jusqu’à 3 rangs au-dessus et 2 en dessous."
    : "Zone de défi : jusqu’à 2 rangs au-dessus et 1 rang en dessous.";
}

export function fmtScore(v: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(v));
}

/** Rang en français : 1er, 2e, 3e… */
export function ordinal(n: number) {
  return n === 1 ? "1er" : `${n}e`;
}
