import "server-only";
import { db } from "@/lib/db";
import type { Viewer } from "@/lib/auth/viewer";
import { getGame, isSolo } from "@/lib/data/games";
import { DEFAULT_POOLS, hasVeto, type VetoPool, type VetoStep } from "@/lib/rules/veto";
import { seriesScores } from "@/lib/rules/rankings";
import { ROUND_LABEL } from "@/lib/rules/playoffs";
import { recipients } from "@/lib/rankings/engine";
import { matchState, namesFor } from "./queries";
import { finalizeMatch, settlePlayoffs } from "./results";
import { mvpPanel } from "@/lib/players";

/** Check-in : ouvert 30 min avant l'heure, forfait 15 min après pour l'absent. */
export const CHECKIN_OPEN_MIN = 30;
export const CHECKIN_GRACE_MIN = 15;

/** Pool actif du jeu : dernier cycle commencé, sinon le pool par défaut. */
export async function activePool(game: string, at = new Date()): Promise<VetoPool> {
  const c = await db.mapCycle.findFirst({ where: { game, startsAt: { lte: at } }, orderBy: { startsAt: "desc" } });
  if (c) return c.maps as VetoPool;
  return game === "cod" ? DEFAULT_POOLS.cod : DEFAULT_POOLS.val;
}

export async function logEvent(matchId: string, kind: "SYSTEM" | "REFEREE" | "CHAT", text: string, authorId?: string, side?: "a" | "b") {
  await db.matchEvent.create({ data: { matchId, kind, text, authorId, side } });
}

/** Côté du visiteur : « a », « b » ou null ; `lead` = peut agir (capitaine, gestionnaire, joueur en 1v1). */
export async function sideOf(m: { game: string; a: string; b: string }, viewerId: string) {
  for (const side of ["a", "b"] as const) {
    const id = m[side];
    if ((await recipients(m.game, id)).includes(viewerId)) return { side, lead: true };
    const g = getGame(m.game);
    if (g && !isSolo(g) && (await db.rosterMember.count({ where: { rosterId: id, userId: viewerId, leftAt: null } }))) return { side, lead: false };
  }
  return { side: null, lead: false };
}

/** Forfait au check-in : 15 min après l'heure, l'équipe absente perd (si l'autre est présente). */
export async function settleCheckIn(matchId: string) {
  const m = await db.match.findUnique({ where: { id: matchId } });
  if (!m || !["SCHEDULED", "CHECK_IN"].includes(m.status)) return;
  if (Date.now() < m.scheduledAt.getTime() + CHECKIN_GRACE_MIN * 60_000) return;
  if (!!m.checkInA === !!m.checkInB) return;
  const winner = m.checkInA ? m.a : m.b;
  const [w] = seriesScores(m.series)[0];
  if (await finalizeMatch(m.id, winner, w, 0, "auto")) await logEvent(m.id, "SYSTEM", `Forfait : absence au check-in (${CHECKIN_GRACE_MIN} min après l’heure).`);
}

export async function getMatchRoom(matchId: string, viewer: Viewer | null) {
  await settleCheckIn(matchId);
  await settlePlayoffs();
  const m = await db.match.findUnique({
    where: { id: matchId },
    include: {
      challenge: true,
      veto: true,
      submissions: { orderBy: { createdAt: "desc" }, take: 1, include: { disputes: { orderBy: { id: "desc" }, take: 1 }, uploader: { select: { pseudo: true } } } },
      events: { orderBy: { createdAt: "asc" }, take: 300 },
    },
  });
  if (!m) return null;
  const staff = viewer?.role === "admin" || viewer?.role === "arbitre";
  const me = viewer ? await sideOf(m, viewer.id) : { side: null, lead: false };
  const names = await namesFor([m]);
  const g = getGame(m.game);
  const lineup = async (id: string) => {
    if (g && isSolo(g)) return [];
    const rs = await db.rosterMember.findMany({ where: { rosterId: id, leftAt: null }, include: { user: { select: { pseudo: true } } }, orderBy: { joinedAt: "asc" } });
    return rs.map((r) => ({ pseudo: r.user.pseudo, sub: r.role !== "STARTER" }));
  };
  const authors = await db.user.findMany({ where: { id: { in: [...new Set(m.events.map((e) => e.authorId).filter((x): x is string => !!x))] } }, select: { id: true, pseudo: true } });
  const pseudo = new Map(authors.map((a) => [a.id, a.pseudo]));
  const sub = m.submissions[0];
  const frozen = m.veto?.pool as VetoPool | undefined;
  const pool = frozen && (Array.isArray(frozen) ? frozen.length > 0 : Object.keys(frozen).length > 0) ? frozen : await activePool(m.game);
  const now = new Date();
  return {
    id: m.id,
    game: m.game,
    gameName: g?.name ?? m.game,
    logo: g?.logo ?? "",
    series: m.series,
    type: m.type,
    comp: m.type === "PLAYOFF" ? `Playoffs · ${g?.name}${m.round ? ` · ${ROUND_LABEL[m.round] ?? m.round}` : ""}` : `RushXP Rankings · ${g?.name}`,
    scheduledAt: m.scheduledAt.toISOString(),
    status: m.status,
    state: matchState(m.status, m.scheduledAt, now),
    a: { id: m.a, ...(names.get(m.a) ?? { name: "?", tag: "?", structureId: null }), checkIn: !!m.checkInA, lineup: await lineup(m.a) },
    b: { id: m.b, ...(names.get(m.b) ?? { name: "?", tag: "?", structureId: null }), checkIn: !!m.checkInB, lineup: await lineup(m.b) },
    score: m.scoreA != null ? [m.scoreA, m.scoreB ?? 0] : null,
    winner: (m.winner === m.a ? "a" : m.winner === m.b ? "b" : null) as "a" | "b" | null,
    deltas: m.deltaA != null ? [m.deltaA, m.deltaB ?? 0] : null,
    counted: m.counted,
    challengeId: m.challenge?.id ?? null,
    challengeStatus: m.challenge?.status ?? null,
    submission: sub
      ? { declaredA: sub.declaredA, declaredB: sub.declaredB, status: sub.status, by: sub.uploader.pseudo, side: (await sideOf(m, sub.uploaderId)).side, dispute: sub.disputes[0]?.reason ?? null, decision: sub.disputes[0]?.decision ?? null }
      : null,
    veto: hasVeto(m.game) ? { steps: (m.veto?.steps as VetoStep[] | undefined) ?? [], pool } : null,
    streams: (m.streamLinks as { platform: string; url: string }[]) ?? [],
    events: m.events
      .filter((e) => staff || !e.hidden)
      .map((e) => ({ id: e.id, kind: e.kind, author: e.authorId ? (pseudo.get(e.authorId) ?? "Membre") : null, side: e.side, text: e.hidden ? `[masqué] ${e.text}` : e.text, at: e.createdAt.toISOString(), mine: e.authorId === viewer?.id, reported: e.reported })),
    viewer: { side: me.side, lead: me.lead, staff, signedIn: !!viewer },
    started: m.scheduledAt <= now,
    mvp: await mvpPanel(m.id, viewer?.id ?? null),
    checkInOpen: now.getTime() >= m.scheduledAt.getTime() - CHECKIN_OPEN_MIN * 60_000,
    scores: seriesScores(m.series),
  };
}
export type MatchRoomData = NonNullable<Awaited<ReturnType<typeof getMatchRoom>>>;
