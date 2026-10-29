/** Assemble le classement « vivant » (scores + défis) et le contexte d'éligibilité. Pur, utilisable client et serveur. */

import { challengeBlock, ineligibilityLabel, isZoneWidened, type ChallengeContext, type Ineligibility } from "@/lib/rules/challenge";
import { stakes } from "@/lib/rules/elo";
import type { ChallengeItem } from "@/lib/data/challenges";
import { DIVISION_SIZE, type RankingRow } from "@/lib/data/repo";

const ACTIVE = new Set(["PENDING", "ACCEPTED", "PLANNED", "CHECK_IN", "LIVE", "SUBMITTED", "DISPUTED"]);

export function liveRows(base: RankingRow[], challenges: ChallengeItem[]): RankingRow[] {
  const me = base.find((r) => r.isMe);
  const delta = new Map<string, number>();
  for (const c of challenges) {
    if (c.deltaMe == null || !me) continue;
    delta.set(me.id, (delta.get(me.id) ?? 0) + c.deltaMe);
    delta.set(c.oppId, (delta.get(c.oppId) ?? 0) + (c.deltaOpp ?? 0));
  }
  const nDiv = Math.max(1, Math.ceil(base.length / DIVISION_SIZE));
  return base
    .map((r) => ({ ...r, score: r.score + (delta.get(r.id) ?? 0) }))
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ ...r, rank: i + 1, division: r.inPlacement ? nDiv : Math.min(nDiv, Math.floor(i / DIVISION_SIZE) + 1) }));
}

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
