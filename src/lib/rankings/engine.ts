import "server-only";
import { db } from "@/lib/db";
import { CHALLENGE_GAMES, getGame, isSolo } from "@/lib/data/games";
import { RESPONSE_HOURS } from "@/lib/rules/challenge";
import { stakes } from "@/lib/rules/elo";
import { CONFIRM_HOURS, IMMUNITY_HOURS, REMIND_HOURS, daysBetween, inactivityStep, rankOf, resolveMatch } from "@/lib/rules/rankings";
import { PAIR_WINDOW_DAYS } from "@/lib/rules/challenge";
import { readGames, type GameScore } from "@/lib/rules/series";

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
const H = 36e5;

/** Destinataires d'une entité : le joueur (1v1) ou le capitaine et les gestionnaires (équipe). */
export async function recipients(game: string, entityId: string, client: Tx | typeof db = db): Promise<string[]> {
  const g = getGame(game);
  if (g && isSolo(g)) return [entityId];
  const r = await client.roster.findUnique({ where: { id: entityId }, select: { captainId: true, structure: { select: { staff: { select: { userId: true } } } } } });
  if (!r) return [];
  return [...new Set([r.captainId, ...r.structure.staff.map((s) => s.userId)].filter((x): x is string => !!x))];
}

export async function notifyEntity(game: string, entityId: string, text: string, link: string, client: Tx | typeof db = db) {
  const ids = await recipients(game, entityId, client);
  if (ids.length) await client.notification.createMany({ data: ids.map((userId) => ({ userId, category: "defis", text, link })) });
}

export async function entityName(game: string, id: string, client: Tx | typeof db = db) {
  const g = getGame(game);
  if (g && isSolo(g)) return (await client.user.findUnique({ where: { id }, select: { pseudo: true } }))?.pseudo ?? "Adversaire";
  const r = await client.roster.findUnique({ where: { id }, select: { name: true, structure: { select: { name: true } } } });
  return r ? (r.name === r.structure.name ? r.name : `${r.structure.name} · ${r.name}`) : "Adversaire";
}

/** Mémorise le rang de chacun avant un recalcul (flèches ▲ ▼ du classement). */
async function snapshotRanks(tx: Tx, game: string) {
  const all = await tx.rankingEntry.findMany({ where: { game } });
  const ranks = rankOf(all);
  await Promise.all(all.map((e) => tx.rankingEntry.update({ where: { game_entityId: { game, entityId: e.entityId } }, data: { prevRank: ranks.get(e) } })));
}

/**
 * Valide un résultat : Elo (si la paire n'a pas déjà 2 matchs comptés sur 30 jours), bilan, placement,
 * immunité du défenseur victorieux, classement recalculé. Idempotent : ne s'applique qu'une fois.
 */
export async function applyResult(challengeId: string, winnerId: string, scoreW: number, scoreL: number, how: "confirmed" | "auto" | "referee", games: GameScore[] = []) {
  const now = new Date();
  const done = await db.$transaction(async (tx) => {
    const c = await tx.challenge.findUnique({ where: { id: challengeId }, include: { match: true } });
    if (!c?.match || !["PLANNED", "SUBMITTED", "DISPUTED"].includes(c.status)) return null;
    const claimed = await tx.challenge.updateMany({ where: { id: c.id, status: c.status }, data: { status: "DONE" } });
    if (claimed.count !== 1) return null;
    const m = c.match;
    const [A, B] = await Promise.all([
      tx.rankingEntry.findUnique({ where: { game_entityId: { game: c.game, entityId: m.a } } }),
      tx.rankingEntry.findUnique({ where: { game_entityId: { game: c.game, entityId: m.b } } }),
    ]);
    if (!A || !B) return null;
    const pair = await tx.match.findMany({
      where: { game: c.game, counted: true, playedAt: { gte: new Date(now.getTime() - PAIR_WINDOW_DAYS * 86_400_000) }, OR: [{ a: m.a, b: m.b }, { a: m.b, b: m.a }] },
      select: { playedAt: true },
    });
    const aWon = winnerId === m.a;
    const out = resolveMatch(A, B, aWon, pair.map((p) => p.playedAt!), now);
    if (out.counted) await snapshotRanks(tx, c.game);
    const upd = (e: typeof A, delta: number, won: boolean, defender: boolean) =>
      tx.rankingEntry.update({
        where: { game_entityId: { game: c.game, entityId: e.entityId } },
        data: {
          score: Math.max(0, e.score + delta),
          placementMatches: { increment: 1 },
          wins: { increment: won ? 1 : 0 },
          losses: { increment: won ? 0 : 1 },
          lastMatchAt: now,
          penaltyLevel: 0,
          ...(defender && won ? { immunityUntil: new Date(now.getTime() + IMMUNITY_HOURS * H) } : {}),
        },
      });
    await upd(A, out.deltaA, aWon, c.defenderId === m.a);
    await upd(B, out.deltaB, !aWon, c.defenderId === m.b);
    await tx.match.update({
      where: { id: m.id },
      data: { status: "DONE", winner: winnerId, scoreA: aWon ? scoreW : scoreL, scoreB: aWon ? scoreL : scoreW, counted: out.counted, deltaA: out.deltaA, deltaB: out.deltaB, playedAt: now, ...(games.length ? { games: games as object[] } : {}) },
    });
    await tx.resultSubmission.updateMany({ where: { matchId: m.id, status: { in: ["AWAITING_OPPONENT", "REFEREE_REVIEW"] } }, data: { status: how === "auto" ? "AUTO_VALIDATED" : "VALIDATED" } });
    return { c, m, out };
  });
  if (!done) return false;
  const { c, m, out } = done;
  await (await import("@/lib/achievements")).syncMatchAchievements(m.id);
  const why = how === "auto" ? "validé automatiquement (24 h sans réponse)" : how === "referee" ? "validé par un arbitre" : "confirmé par l’adversaire";
  for (const [id, d] of [[m.a, out.deltaA], [m.b, out.deltaB]] as const) {
    const opp = await entityName(c.game, id === m.a ? m.b : m.a);
    await notifyEntity(c.game, id, `Résultat ${why} contre ${opp} : ${winnerId === id ? "victoire" : "défaite"}${out.counted ? `, ${d >= 0 ? "+" : "−"}${Math.abs(d)} pts` : " (non compté au classement)"}.`, `/rankings/defis?game=${c.game}`);
  }
  return true;
}

/** Échéances : relance à 24 h, expiration à 48 h, validation automatique 24 h après une déclaration, matchs non joués. */
export async function settleDue(game?: string) {
  const now = new Date();
  const where = game ? { game } : {};
  const toRemind = await db.challenge.findMany({ where: { ...where, status: "PENDING", remindedAt: null, createdAt: { lte: new Date(now.getTime() - REMIND_HOURS * H) }, respondBy: { gt: now } } });
  for (const c of toRemind) {
    const ok = await db.challenge.updateMany({ where: { id: c.id, remindedAt: null }, data: { remindedAt: now } });
    if (ok.count) await notifyEntity(c.game, c.defenderId, `Rappel : un défi de ${await entityName(c.game, c.challengerId)} attend votre réponse (expiration sous 24 h).`, `/rankings/defis?game=${c.game}`);
  }
  const expired = await db.challenge.findMany({ where: { ...where, status: "PENDING", respondBy: { lte: now } } });
  for (const c of expired) {
    const ok = await db.challenge.updateMany({ where: { id: c.id, status: "PENDING" }, data: { status: "EXPIRED" } });
    if (ok.count) await notifyEntity(c.game, c.challengerId, `Votre défi à ${await entityName(c.game, c.defenderId)} a expiré sans réponse.`, `/rankings/defis?game=${c.game}`);
  }
  const submitted = await db.challenge.findMany({
    where: { ...where, status: "SUBMITTED" },
    include: { match: { include: { submissions: { where: { status: "AWAITING_OPPONENT" }, orderBy: { createdAt: "desc" }, take: 1 } } } },
  });
  for (const c of submitted) {
    const s = c.match?.submissions[0];
    if (!s || s.createdAt.getTime() + CONFIRM_HOURS * H > now.getTime() || s.declaredA == null || s.declaredB == null) continue;
    const aWon = s.declaredA > s.declaredB;
    await applyResult(c.id, aWon ? c.match!.a : c.match!.b, Math.max(s.declaredA, s.declaredB), Math.min(s.declaredA, s.declaredB), "auto", readGames(s.games));
  }
  // 7 jours pour jouer après le créneau : sans déclaration, le défi est annulé sans pénalité.
  await db.challenge.updateMany({ where: { ...where, status: "PLANNED", slot: { lte: new Date(now.getTime() - 7 * 86_400_000) } }, data: { status: "CANCELLED", refusalReason: "Match non joué dans les 7 jours" } });
}

const ACTIVE = ["PENDING", "ACCEPTED", "PLANNED", "CHECK_IN", "LIVE", "SUBMITTED", "DISPUTED"] as const;

/** Trois soirées à 20:00 (heure de La Réunion), à partir de J+2. */
export function defaultSlots(now = new Date()): Date[] {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion" }).format(now);
  const base = new Date(`${day}T20:00:00+04:00`).getTime();
  return [2, 3, 4].map((d) => new Date(base + d * 86_400_000));
}

/** Placement : le système apparie chaque nouvel entrant avec l'adversaire disponible au score le plus proche. */
export async function autoPair(game: string) {
  const now = new Date();
  const entries = await db.rankingEntry.findMany({ where: { game } });
  const active = await db.challenge.findMany({ where: { game, status: { in: [...ACTIVE] } }, select: { challengerId: true, defenderId: true } });
  const busy = new Set(active.flatMap((c) => [c.challengerId, c.defenderId]));
  const g = getGame(game);
  const structures = g && !isSolo(g) ? new Map((await db.roster.findMany({ where: { id: { in: entries.map((e) => e.entityId) } }, select: { id: true, structureId: true } })).map((r) => [r.id, r.structureId])) : null;
  let created = 0;
  for (const e of entries.filter((x) => x.placementMatches < 5).sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())) {
    if (busy.has(e.entityId)) continue;
    const opp = entries
      .filter((o) => o.entityId !== e.entityId && !busy.has(o.entityId) && (!structures || structures.get(o.entityId) !== structures.get(e.entityId)))
      .sort((x, y) => Math.abs(x.score - e.score) - Math.abs(y.score - e.score))[0];
    if (!opp) continue;
    const st = stakes(e, opp);
    await db.challenge.create({
      data: { game, challengerId: e.entityId, defenderId: opp.entityId, origin: "AUTO", proposedSlots: defaultSlots(now), stakesWin: st.win, stakesLoss: st.loss, respondBy: new Date(now.getTime() + RESPONSE_HOURS * H) },
    });
    busy.add(e.entityId).add(opp.entityId);
    created++;
    await notifyEntity(game, opp.entityId, `Appariement de placement : ${await entityName(game, e.entityId)} vous défie. Choisissez un créneau sous 48 h.`, `/rankings/defis?game=${game}`);
    await notifyEntity(game, e.entityId, `Match de placement proposé contre ${await entityName(game, opp.entityId)}.`, `/rankings/defis?game=${game}`);
  }
  return created;
}

/** Pénalités d'inactivité (une fois par palier, jamais pendant un congé déclaré). */
export async function applyInactivity(game: string) {
  const now = new Date();
  const g = getGame(game);
  const solo = !!g && isSolo(g);
  let n = 0;
  for (const e of await db.rankingEntry.findMany({ where: { game } })) {
    if (e.onLeaveUntil && e.onLeaveUntil > now) continue;
    const step = inactivityStep(daysBetween(e.lastMatchAt ?? e.createdAt, now), solo, e.penaltyLevel);
    if (!step.penalty) continue;
    await db.rankingEntry.update({ where: { game_entityId: { game, entityId: e.entityId } }, data: { score: Math.max(0, e.score - step.penalty), penaltyLevel: step.level } });
    await notifyEntity(game, e.entityId, `Inactivité : −${step.penalty} pts au classement ${g?.name ?? game}. Jouez un match officiel pour l’arrêter.`, `/rankings/defis?game=${game}`);
    n++;
  }
  return n;
}

export async function dailyRankings() {
  const out: Record<string, { paired: number; penalized: number }> = {};
  await settleDue();
  for (const g of CHALLENGE_GAMES) out[g.id] = { paired: await autoPair(g.id), penalized: await applyInactivity(g.id) };
  return out;
}
