import "server-only";
import { db } from "@/lib/db";
import { CONFIRM_HOURS } from "@/lib/rules/rankings";
import { cleanGames, gameLabel, readGames, seriesFromGames, type GameScore } from "@/lib/rules/series";
import { nextRound } from "@/lib/rules/playoffs";
import { applyResult, entityName, notifyEntity, recipients } from "@/lib/rankings/engine";
import { logEvent } from "./room";
import { isUploadedUrl } from "@/lib/integrations";

export type Outcome = { ok: true; message?: string } | { ok: false; errors: Record<string, string> };
const fail = (m: string, field = "_"): Outcome => ({ ok: false, errors: { [field]: m } });
const OPEN = ["SCHEDULED", "CHECK_IN", "LIVE"] as const;

async function sideFor(m: { game: string; a: string; b: string }, userId: string) {
  if ((await recipients(m.game, m.a)).includes(userId)) return "a" as const;
  if ((await recipients(m.game, m.b)).includes(userId)) return "b" as const;
  return null;
}

/** Déclaration du résultat par un camp, après l'heure du match. Provisoire jusqu'à confirmation (ou 24 h). */
/** Résumé « Ascent 13–9 · Bind 10–13 · … » (côté A–B). */
export function gamesSummary(game: string, games: GameScore[]) {
  return games.map((g, i) => `${g.map ?? gameLabel(game, i)} ${g.a}–${g.b}`).join(" · ");
}

/** Déclaration du résultat partie par partie (scores côté A–B) : le score de la série en est déduit. */
export async function declareMatchResult(userId: string, matchId: string, rawGames: unknown, fileUrl = ""): Promise<Outcome> {
  if (fileUrl && !isUploadedUrl(fileUrl)) return fail("Capture invalide.");
  const m = await db.match.findUnique({ where: { id: matchId } });
  if (!m) return fail("Match introuvable.");
  const side = await sideFor(m, userId);
  if (!side) return fail("Seul le capitaine, un gestionnaire ou le joueur concerné déclare le résultat.");
  if (!(OPEN as readonly string[]).includes(m.status)) return fail("Le résultat a déjà été déclaré.");
  if (m.scheduledAt > new Date()) return fail("Le résultat se déclare après l’heure du match.");
  const games = cleanGames(rawGames);
  const s = seriesFromGames(m.series, games);
  if ("error" in s) return fail(s.error, "games");
  const aWon = s.a > s.b;
  const won = side === "a" ? aWon : !aWon;
  const [w, l] = [Math.max(s.a, s.b), Math.min(s.a, s.b)];
  await db.$transaction(async (tx) => {
    const ok = await tx.match.updateMany({ where: { id: m.id, status: { in: [...OPEN] } }, data: { status: "SUBMITTED" } });
    if (!ok.count) throw new Error("déjà déclaré");
    if (m.challengeId) await tx.challenge.update({ where: { id: m.challengeId }, data: { status: "SUBMITTED" } });
    await tx.resultSubmission.create({ data: { matchId: m.id, uploaderId: userId, fileUrl, declaredA: s.a, declaredB: s.b, games: games as object[], status: "AWAITING_OPPONENT" } });
  });
  const mine = side === "a" ? m.a : m.b;
  const other = side === "a" ? m.b : m.a;
  await logEvent(m.id, "SYSTEM", `Résultat déclaré par ${await entityName(m.game, mine)} : ${won ? "victoire" : "défaite"} ${w}–${l} (${gamesSummary(m.game, games)})${fileUrl ? ", capture jointe" : ""}. En attente de confirmation (24 h).`);
  await notifyEntity(m.game, other, `${await entityName(m.game, mine)} déclare ${won ? "une victoire" : "une défaite"} ${w}–${l}. Confirmez ou contestez sous 24 h.`, `/match?m=${m.id}`);
  return { ok: true, message: "Résultat déclaré : provisoire jusqu’à confirmation adverse (validation automatique sous 24 h)." };
}

/** Résultat officiel : Elo pour un défi, qualification au tour suivant pour les Playoffs. */
export async function finalizeMatch(matchId: string, winnerId: string, w: number, l: number, how: "confirmed" | "auto" | "referee", games: GameScore[] = []) {
  const m = await db.match.findUnique({ where: { id: matchId } });
  if (!m) return false;
  if (m.challengeId) return applyResult(m.challengeId, winnerId, w, l, how, games);
  const aWon = winnerId === m.a;
  const claimed = await db.match.updateMany({
    where: { id: m.id, status: { in: ["SCHEDULED", "CHECK_IN", "LIVE", "SUBMITTED", "DISPUTED"] } },
    data: { status: "DONE", winner: winnerId, scoreA: aWon ? w : l, scoreB: aWon ? l : w, playedAt: new Date(), ...(games.length ? { games: games as object[] } : {}) },
  });
  if (!claimed.count) return false;
  await db.resultSubmission.updateMany({ where: { matchId: m.id, status: { in: ["AWAITING_OPPONENT", "REFEREE_REVIEW"] } }, data: { status: how === "auto" ? "AUTO_VALIDATED" : "VALIDATED" } });
  await logEvent(m.id, "SYSTEM", `Résultat officiel : ${await entityName(m.game, winnerId)} l’emporte ${w}–${l}.`);
  for (const id of [m.a, m.b]) await notifyEntity(m.game, id, `Playoffs : ${id === winnerId ? "qualification" : "élimination"} (${w}–${l}).`, `/playoffs?jeu=${m.game}`);
  if (m.round && m.seasonYear) await advance(m.game, m.seasonYear, m.round);
  await (await import("@/lib/achievements")).syncMatchAchievements(m.id);
  return true;
}

/** Crée le match du tour suivant dès que les deux qualifiés sont connus. */
async function advance(game: string, year: number, round: string) {
  const next = nextRound(round);
  if (!next) return;
  const [r1, r2] = next.from;
  const done = await db.match.findMany({ where: { game, seasonYear: year, round: { in: [r1, r2] }, status: "DONE" } });
  const w1 = done.find((x) => x.round === r1)?.winner;
  const w2 = done.find((x) => x.round === r2)?.winner;
  if (!w1 || !w2) return;
  if (await db.match.findFirst({ where: { game, seasonYear: year, round: next.round } })) return;
  const last = done.reduce((a, x) => (x.scheduledAt > a ? x.scheduledAt : a), new Date(0));
  const g = await db.game.findUnique({ where: { id: game } });
  const nm = await db.match.create({
    data: { game, type: "PLAYOFF", a: w1, b: w2, series: g?.series ?? "BO3", scheduledAt: new Date(last.getTime() + 14 * 86_400_000), round: next.round, seasonYear: year },
  });
  await logEvent(nm.id, "SYSTEM", `${next.label} créé·e. Date à confirmer par l’organisation.`);
  for (const id of [w1, w2]) await notifyEntity(game, id, `Playoffs : vous êtes qualifiés pour ${next.label.toLowerCase()}.`, `/match?m=${nm.id}`);
}

/** Confirmation (résultat officiel) ou contestation (arbitre) par le camp qui n'a pas déclaré. */
export async function answerMatchResult(userId: string, matchId: string, confirm: boolean, reason?: string): Promise<Outcome> {
  const m = await db.match.findUnique({ where: { id: matchId }, include: { submissions: { orderBy: { createdAt: "desc" }, take: 1 } } });
  const sub = m?.submissions[0];
  if (!m || m.status !== "SUBMITTED" || !sub || sub.status !== "AWAITING_OPPONENT") return fail("Aucun résultat à confirmer.");
  const declaredBy = await sideFor(m, sub.uploaderId);
  const me = await sideFor(m, userId);
  if (!me || me === declaredBy) return fail("Seul l’adversaire confirme ou conteste le résultat.");
  if (confirm) {
    const aWon = sub.declaredA! > sub.declaredB!;
    await finalizeMatch(m.id, aWon ? m.a : m.b, Math.max(sub.declaredA!, sub.declaredB!), Math.min(sub.declaredA!, sub.declaredB!), "confirmed", readGames(sub.games));
    return { ok: true, message: m.challengeId ? "Résultat confirmé : classement recalculé." : "Résultat confirmé." };
  }
  const why = (reason ?? "").trim();
  if (why.length < 5) return fail("Expliquez la contestation (5 caractères minimum).", "reason");
  await db.$transaction([
    ...(m.challengeId ? [db.challenge.update({ where: { id: m.challengeId }, data: { status: "DISPUTED" } })] : []),
    db.match.update({ where: { id: m.id }, data: { status: "DISPUTED" } }),
    db.resultSubmission.update({ where: { id: sub.id }, data: { status: "REFEREE_REVIEW" } }),
    db.dispute.create({ data: { submissionId: sub.id, openedById: userId, reason: why.slice(0, 500) } }),
  ]);
  await logEvent(m.id, "SYSTEM", `Résultat contesté : ${why.slice(0, 200)}. Un arbitre va trancher.`);
  const opp = me === "a" ? m.b : m.a;
  await notifyEntity(m.game, opp, `Résultat contesté par ${await entityName(m.game, me === "a" ? m.a : m.b)} : un arbitre va trancher.`, `/match?m=${m.id}`);
  return { ok: true, message: "Contestation envoyée : le résultat est suspendu jusqu’à la décision d’un arbitre." };
}

/** Playoffs : validation automatique d'un résultat déclaré sans réponse sous 24 h. */
export async function settlePlayoffs() {
  const due = await db.match.findMany({
    where: { type: "PLAYOFF", status: "SUBMITTED" },
    include: { submissions: { where: { status: "AWAITING_OPPONENT", createdAt: { lte: new Date(Date.now() - CONFIRM_HOURS * 36e5) } }, take: 1 } },
  });
  for (const m of due) {
    const s = m.submissions[0];
    if (!s || s.declaredA == null || s.declaredB == null) continue;
    await finalizeMatch(m.id, s.declaredA > s.declaredB ? m.a : m.b, Math.max(s.declaredA, s.declaredB), Math.min(s.declaredA, s.declaredB), "auto", readGames(s.games));
  }
}
