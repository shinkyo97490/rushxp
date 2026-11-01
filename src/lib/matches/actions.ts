"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { applyVeto, nextStep, playedMaps, type VetoPool, type VetoStep } from "@/lib/rules/veto";
import { STREAM_PLATFORMS, validateStreamUrl, type StreamPlatform } from "@/lib/rules/streams";
import { entityName, notifyEntity } from "@/lib/rankings/engine";
import { answerMatchResult, declareMatchResult, finalizeMatch, gamesSummary } from "./results";
import { cleanGames, seriesFromGames, type GameScore } from "@/lib/rules/series";
import { mvpPanel } from "@/lib/players";
import { activePool, CHECKIN_GRACE_MIN, CHECKIN_OPEN_MIN, logEvent, sideOf } from "./room";

export type MatchResult = { ok: true; message?: string } | { ok: false; errors: Record<string, string> };
const fail = (m: string): MatchResult => ({ ok: false, errors: { _: m } });
const done = (message?: string): MatchResult => {
  revalidatePath("/match");
  revalidatePath("/calendrier");
  return { ok: true, message };
};

async function ctx(matchId: string) {
  const v = await getViewer();
  if (!v) return null;
  const m = await db.match.findUnique({ where: { id: matchId }, include: { veto: true, challenge: true } });
  if (!m) return null;
  const staff = v.role === "admin" || v.role === "arbitre";
  return { v, m, staff, ...(await sideOf(m, v.id)) };
}

export async function checkInAction(matchId: string): Promise<MatchResult> {
  const c = await ctx(matchId);
  if (!c || !c.side || !c.lead) return fail("Seul le capitaine, un gestionnaire ou le joueur concerné confirme la présence.");
  const { m } = c;
  if (!["SCHEDULED", "CHECK_IN"].includes(m.status)) return fail("Le check-in est terminé.");
  const now = Date.now();
  if (now < m.scheduledAt.getTime() - CHECKIN_OPEN_MIN * 60_000) return fail(`Le check-in ouvre ${CHECKIN_OPEN_MIN} min avant l’heure du match.`);
  if (now > m.scheduledAt.getTime() + CHECKIN_GRACE_MIN * 60_000) return fail("Check-in clos.");
  const field = c.side === "a" ? "checkInA" : "checkInB";
  if (m[field]) return fail("Présence déjà confirmée.");
  const both = c.side === "a" ? !!m.checkInB : !!m.checkInA;
  await db.match.update({ where: { id: m.id }, data: { [field]: new Date(), status: both ? "LIVE" : "CHECK_IN" } });
  await logEvent(m.id, "SYSTEM", `${c.v.pseudo} a confirmé la présence de son camp.${both ? " Les deux camps sont présents : le match peut commencer." : ""}`, c.v.id, c.side);
  return done("Présence confirmée.");
}

export async function vetoAction(input: { matchId: string; map: string }): Promise<MatchResult> {
  const c = await ctx(input.matchId);
  if (!c) return fail("Session expirée.");
  const { m } = c;
  if (!c.staff && (!c.side || !c.lead)) return fail("Seul le capitaine (ou un gestionnaire) fait le veto.");
  if (!m.checkInA || !m.checkInB) return fail("Le veto commence quand les deux camps ont confirmé leur présence.");
  if (["SUBMITTED", "DONE", "DISPUTED", "CANCELLED"].includes(m.status)) return fail("Le match est terminé.");
  const steps = (m.veto?.steps as VetoStep[] | undefined) ?? [];
  const pool = (m.veto ? (m.veto.pool as VetoPool) : await activePool(m.game)) as VetoPool;
  const step = nextStep(m.game, steps);
  if (!step) return fail("Veto terminé.");
  const actor = c.staff && !c.side ? (step.actor as "A" | "B") : c.side === "a" ? "A" : "B";
  const r = applyVeto(m.game, pool, steps, actor, input.map);
  if ("error" in r) return fail(r.error);
  // Écriture conditionnelle : deux clics simultanés ne peuvent pas jouer la même étape.
  if (m.veto) {
    const upd = await db.veto.updateMany({ where: { matchId: m.id, steps: { equals: steps as object } }, data: { steps: r.steps as object[] } });
    if (!upd.count) return fail("Le veto a changé : réessayez.");
  } else {
    await db.veto.create({ data: { matchId: m.id, steps: r.steps as object[], pool: pool as object } });
  }
  const added = r.steps.slice(steps.length);
  for (const s of added)
    await logEvent(m.id, "SYSTEM", s.action === "decider" ? `Carte décisive : ${s.map}.` : `Veto : ${await entityName(m.game, s.actor === "A" ? m.a : m.b)} ${s.action === "ban" ? "bannit" : "choisit"} ${s.map}${s.mode ? ` (${s.mode})` : ""}.`);
  if (!nextStep(m.game, r.steps)) await logEvent(m.id, "SYSTEM", `Veto terminé · cartes : ${playedMaps(r.steps).map((s) => s.map).join(", ")}.`);
  return done();
}

export async function chatAction(input: { matchId: string; text: string }): Promise<MatchResult> {
  const c = await ctx(input.matchId);
  if (!c || (!c.side && !c.staff)) return fail("Seuls les participants et les arbitres écrivent dans le salon.");
  const text = input.text.trim().slice(0, 500);
  if (!text) return fail("Message vide.");
  await logEvent(c.m.id, c.staff && !c.side ? "REFEREE" : "CHAT", text, c.v.id, c.side ?? undefined);
  return done();
}

export async function reportChatAction(eventId: string): Promise<MatchResult> {
  const v = await getViewer();
  if (!v) return fail("Connectez-vous.");
  const e = await db.matchEvent.findUnique({ where: { id: eventId } });
  if (!e || e.kind !== "CHAT" || e.authorId === v.id) return fail("Message introuvable.");
  await db.matchEvent.update({ where: { id: eventId }, data: { reported: true } });
  revalidatePath("/arbitrage");
  return done("Message signalé aux arbitres.");
}

export async function addStreamAction(input: { matchId: string; platform: string; url: string }): Promise<MatchResult> {
  const c = await ctx(input.matchId);
  if (!c || (!c.lead && !c.staff)) return fail("Seuls les capitaines et les arbitres ajoutent une diffusion.");
  if (!(input.platform in STREAM_PLATFORMS)) return fail("Plateforme inconnue.");
  const r = validateStreamUrl(input.platform as StreamPlatform, input.url);
  if (!r.ok) return { ok: false, errors: { url: r.error } };
  const links = ((c.m.streamLinks as { platform: string; url: string }[]) ?? []).filter((l) => l.url !== r.url);
  if (links.length >= 4) return fail("4 diffusions maximum.");
  await db.match.update({ where: { id: c.m.id }, data: { streamLinks: [...links, { platform: input.platform, url: r.url }] } });
  await logEvent(c.m.id, "SYSTEM", `Diffusion ${input.platform} annoncée : ${r.url}`);
  return done("Diffusion ajoutée.");
}

/** Décision d'arbitre sur un résultat contesté (ou saisie directe) : motivée et inscrite au journal. */
export async function refereeDecisionAction(input: { matchId: string; games: GameScore[]; reason: string }): Promise<MatchResult> {
  const c = await ctx(input.matchId);
  if (!c?.staff) return fail("Réservé aux arbitres.");
  const { m } = c;
  const reason = input.reason.trim();
  if (reason.length < 5) return { ok: false, errors: { reason: "Motivez la décision (5 caractères minimum)." } };
  const games = cleanGames(input.games);
  const s = seriesFromGames(m.series, games);
  if ("error" in s) return fail(s.error);
  const [w, l] = [Math.max(s.a, s.b), Math.min(s.a, s.b)];
  const winnerId = s.a > s.b ? m.a : m.b;
  const ok = await finalizeMatch(m.id, winnerId, w, l, "referee", games);
  if (!ok) return fail("Le résultat a déjà été validé.");
  await db.dispute.updateMany({ where: { submission: { matchId: m.id }, decidedAt: null }, data: { decision: reason, refereeId: c.v.id, decidedAt: new Date() } });
  await logEvent(m.id, "REFEREE", `Décision : victoire ${await entityName(m.game, winnerId)} ${w}–${l} (${gamesSummary(m.game, games)}). Motif : ${reason}`, c.v.id);
  await db.auditLog.create({ data: { actorId: c.v.id, action: "match.decision", target: `match:${m.id}`, after: { winner: winnerId, score: `${w}-${l}`, games: games as object[], reason } } });
  for (const id of [m.a, m.b]) await notifyEntity(m.game, id, `Décision d’arbitre rendue sur votre match : ${reason}`, `/match?m=${m.id}`);
  revalidatePath("/arbitrage");
  revalidatePath("/playoffs");
  return done(m.challenge ? "Décision enregistrée : classement recalculé." : "Décision enregistrée.");
}

export async function declareMatchAction(input: { matchId: string; games: GameScore[]; fileUrl?: string }): Promise<MatchResult> {
  const v = await getViewer();
  if (!v) return fail("Session expirée.");
  const r = await declareMatchResult(v.id, input.matchId, input.games, input.fileUrl ?? "");
  if (r.ok) revalidatePath("/rankings/defis");
  return r.ok ? done(r.message) : r;
}

export async function answerMatchAction(input: { matchId: string; confirm: boolean; reason?: string }): Promise<MatchResult> {
  const v = await getViewer();
  if (!v) return fail("Session expirée.");
  const r = await answerMatchResult(v.id, input.matchId, input.confirm, input.reason);
  if (r.ok) {
    for (const p of ["/rankings", "/rankings/defis", "/classement", "/playoffs", "/arbitrage"]) revalidatePath(p);
  }
  return r.ok ? done(r.message) : r;
}

/** Signalement dans un salon de match : masquer le message ou classer sans suite. */
export async function moderateMatchChatAction(input: { eventId: string; hide: boolean }): Promise<MatchResult> {
  const v = await getViewer();
  if (!v || (v.role !== "admin" && v.role !== "arbitre")) return fail("Réservé aux arbitres.");
  const e = await db.matchEvent.findUnique({ where: { id: input.eventId } });
  if (!e) return fail("Message introuvable.");
  await db.matchEvent.update({ where: { id: e.id }, data: { reported: false, hidden: input.hide } });
  await db.auditLog.create({ data: { actorId: v.id, action: input.hide ? "match-chat.mask" : "match-chat.dismiss", target: `match-event:${e.id}`, before: { text: e.text } } });
  revalidatePath("/arbitrage");
  return done(input.hide ? "Message masqué." : "Signalement classé sans suite.");
}

/** Vote MVP : un par participant, dans les 48 h qui suivent le résultat officiel, jamais pour soi-même. */
export async function voteMvpAction(input: { matchId: string; playerId: string }): Promise<MatchResult> {
  const v = await getViewer();
  if (!v) return fail("Connectez-vous.");
  const panel = await mvpPanel(input.matchId, v.id);
  if (!panel) return fail("Le vote s’ouvre à la validation du résultat.");
  if (!panel.canVote) return fail(panel.open ? "Seuls les joueurs du match votent." : "Vote clos (48 h après le résultat).");
  if (!panel.candidates.some((c) => c.id === input.playerId)) return fail("Joueur introuvable.");
  await db.matchMvp.upsert({
    where: { matchId_voterId: { matchId: input.matchId, voterId: v.id } },
    create: { matchId: input.matchId, voterId: v.id, playerId: input.playerId },
    update: { playerId: input.playerId },
  });
  revalidatePath("/mvp");
  return done("Vote MVP enregistré.");
}
