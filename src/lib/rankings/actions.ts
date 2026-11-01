"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { getGame, isSolo } from "@/lib/data/games";
import { MAX_PENDING_OUT, RESPONSE_HOURS, UNJUSTIFIED_REFUSAL_PENALTY, challengeBlock, ineligibilityLabel } from "@/lib/rules/challenge";
import { START_SCORE, stakes } from "@/lib/rules/elo";
import { eligibility } from "@/lib/rankings-model";
import { entityName, notifyEntity, recipients, settleDue } from "./engine";
import { answerMatchResult } from "@/lib/matches/results";
import { challengeItems, myEntities, rankingRows } from "./queries";

export type RankResult = { ok: true; message?: string } | { ok: false; errors: Record<string, string> };
const fail = (m: string): RankResult => ({ ok: false, errors: { _: m } });
const H = 36e5;

function refresh(game: string) {
  for (const p of ["/rankings", "/rankings/defis", "/rankings/divisions", "/rankings/seeding", "/classement", "/calendrier"]) revalidatePath(p);
  return game;
}

/** L'utilisateur peut-il agir pour cette entité (lui-même en 1v1, capitaine ou gestionnaire en équipe) ? */
async function canActFor(game: string, entityId: string, userId: string) {
  return (await recipients(game, entityId)).includes(userId);
}

/** Entrée en placement : 800 pts, 5 matchs de placement à K = 40. */
export async function enterRankingsAction(input: { game: string; entityId: string }): Promise<RankResult> {
  const v = await getViewer();
  if (!v) return fail("Connectez-vous.");
  const g = getGame(input.game);
  if (!g || g.kind !== "challenge") return fail("Jeu inconnu.");
  const mine = await myEntities(g.id, v);
  const e = mine.find((m) => m.id === input.entityId);
  if (!e?.canAct) return fail(isSolo(g) ? "Action non autorisée." : "Seul le capitaine ou le gestionnaire inscrit l’équipe.");
  if (!isSolo(g)) {
    const starters = await db.rosterMember.count({ where: { rosterId: e.id, leftAt: null, role: "STARTER" } });
    if (starters < g.rosterSize) return fail(`Roster incomplet : ${g.rosterSize} titulaires requis pour entrer au classement.`);
  }
  const exists = await db.rankingEntry.findUnique({ where: { game_entityId: { game: g.id, entityId: e.id } } });
  if (exists) return fail("Déjà inscrit au classement.");
  await db.rankingEntry.create({ data: { game: g.id, entityId: e.id, score: START_SCORE } });
  refresh(g.id);
  return { ok: true, message: `Inscription enregistrée : ${START_SCORE} pts, 5 matchs de placement à venir (appariés par le système).` };
}

/** Lance un défi avec 3 créneaux. Toutes les règles sont revérifiées ici. */
export async function sendChallengeAction(input: { game: string; oppId: string; slots: string[] }): Promise<RankResult> {
  const v = await getViewer();
  if (!v) return fail("Connectez-vous pour défier.");
  const g = getGame(input.game);
  if (!g || g.kind !== "challenge") return fail("Jeu inconnu.");
  await settleDue(g.id);
  const mine = await myEntities(g.id, v);
  const rows = await rankingRows(g.id, mine.map((m) => m.id));
  const me = rows.find((r) => r.isMe);
  if (!me) return fail("Inscrivez-vous d’abord au classement.");
  const opp = rows.find((r) => r.id === input.oppId);
  if (!opp) return fail("Adversaire introuvable.");
  const canAct = !!mine.find((m) => m.id === me.id)?.canAct;
  const items = await challengeItems(g.id, me.id);
  const el = eligibility(rows, items, canAct, isSolo(g));
  const block = challengeBlock(el.ctx, el.ctx.all.find((c) => c.id === opp.id)!);
  if (block) return fail(ineligibilityLabel(block, el.widened));

  const now = Date.now();
  const slots = [...new Set(input.slots)].map((s) => new Date(s));
  if (slots.length !== 3 || slots.some((d) => isNaN(d.getTime()))) return fail("Proposez 3 créneaux différents.");
  if (slots.some((d) => d.getTime() < now + 24 * H || d.getTime() > now + 9 * 86_400_000)) return fail("Créneaux entre 24 h et 9 jours à l’avance.");
  const [A, B] = await Promise.all([
    db.rankingEntry.findUniqueOrThrow({ where: { game_entityId: { game: g.id, entityId: me.id } } }),
    db.rankingEntry.findUniqueOrThrow({ where: { game_entityId: { game: g.id, entityId: opp.id } } }),
  ]);
  const st = stakes(A, B);
  await db.challenge.create({
    data: { game: g.id, challengerId: me.id, defenderId: opp.id, proposedSlots: slots.sort((a, b) => a.getTime() - b.getTime()), stakesWin: st.win, stakesLoss: st.loss, respondBy: new Date(now + RESPONSE_HOURS * H) },
  });
  await notifyEntity(g.id, opp.id, `${me.name}${me.team ? ` · ${me.team}` : ""} vous défie en ${g.name}. Choisissez un créneau sous 48 h.`, `/rankings/defis?game=${g.id}`);
  refresh(g.id);
  return { ok: true, message: `Défi envoyé à ${opp.name}. Réponse attendue sous 48 h (${el.pendingOut + 1} / ${MAX_PENDING_OUT}).` };
}

async function loadChallenge(id: string) {
  return db.challenge.findUnique({ where: { id }, include: { match: { include: { submissions: { orderBy: { createdAt: "desc" }, take: 1 } } } } });
}

/** Réponse du défendeur : un créneau, un refus avec motif admis, ou un refus injustifié (forfait, −40). */
export async function respondChallengeAction(input: { id: string; slot?: string; refuse?: "justified" | "unjustified"; reason?: string }): Promise<RankResult> {
  const v = await getViewer();
  if (!v) return fail("Session expirée.");
  const c = await loadChallenge(input.id);
  if (!c || !(await canActFor(c.game, c.defenderId, v.id))) return fail("Défi introuvable.");
  if (c.status !== "PENDING" || c.respondBy < new Date()) return fail("Ce défi n’attend plus de réponse.");
  const opp = await entityName(c.game, c.defenderId);
  if (input.refuse) {
    if (input.refuse === "justified") {
      const reason = (input.reason ?? "").trim().slice(0, 140) || "Indisponibilité déclarée";
      await db.challenge.updateMany({ where: { id: c.id, status: "PENDING" }, data: { status: "REFUSED", refusalReason: reason } });
      await notifyEntity(c.game, c.challengerId, `${opp} a refusé votre défi (motif admis : ${reason}).`, `/rankings/defis?game=${c.game}`);
    } else {
      const ok = await db.challenge.updateMany({ where: { id: c.id, status: "PENDING" }, data: { status: "FORFEIT" } });
      if (ok.count) {
        const e = await db.rankingEntry.findUnique({ where: { game_entityId: { game: c.game, entityId: c.defenderId } } });
        if (e) await db.rankingEntry.update({ where: { game_entityId: { game: c.game, entityId: c.defenderId } }, data: { score: Math.max(0, e.score - UNJUSTIFIED_REFUSAL_PENALTY) } });
        await notifyEntity(c.game, c.challengerId, `${opp} a refusé votre défi sans motif : forfait et −${UNJUSTIFIED_REFUSAL_PENALTY} pts pour ${opp}.`, `/rankings/defis?game=${c.game}`);
      }
    }
    refresh(c.game);
    return { ok: true, message: input.refuse === "justified" ? "Refus enregistré, sans pénalité." : `Refus enregistré : forfait et −${UNJUSTIFIED_REFUSAL_PENALTY} pts.` };
  }
  const slot = c.proposedSlots.find((d) => d.toISOString() === input.slot);
  if (!slot) return fail("Choisissez l’un des 3 créneaux proposés.");
  const g = getGame(c.game);
  await db.$transaction(async (tx) => {
    const ok = await tx.challenge.updateMany({ where: { id: c.id, status: "PENDING" }, data: { status: "PLANNED", slot } });
    if (!ok.count) throw new Error("déjà traité");
    await tx.match.create({ data: { game: c.game, type: "CHALLENGE", challengeId: c.id, a: c.challengerId, b: c.defenderId, series: g?.series ?? "BO1", scheduledAt: slot } });
  });
  const when = new Intl.DateTimeFormat("fr-FR", { timeZone: "Indian/Reunion", dateStyle: "full", timeStyle: "short" }).format(slot);
  await notifyEntity(c.game, c.challengerId, `${opp} a accepté votre défi : ${when}.`, `/rankings/defis?game=${c.game}`);
  refresh(c.game);
  return { ok: true, message: `Match planifié : ${when}. Ajouté au calendrier.` };
}

export async function cancelChallengeAction(id: string): Promise<RankResult> {
  const v = await getViewer();
  if (!v) return fail("Session expirée.");
  const c = await loadChallenge(id);
  if (!c || !(await canActFor(c.game, c.challengerId, v.id))) return fail("Défi introuvable.");
  const ok = await db.challenge.updateMany({ where: { id, status: "PENDING" }, data: { status: "CANCELLED" } });
  if (!ok.count) return fail("Ce défi ne peut plus être annulé.");
  await notifyEntity(c.game, c.defenderId, `${await entityName(c.game, c.challengerId)} a annulé son défi.`, `/rankings/defis?game=${c.game}`);
  refresh(c.game);
  return { ok: true, message: "Défi annulé." };
}

/** Déclaration du résultat après le créneau. Provisoire jusqu'à confirmation adverse (ou 24 h). */
/** L'adversaire confirme (classement recalculé) ou conteste (arbitre). */
export async function answerResultAction(input: { id: string; confirm: boolean; reason?: string }): Promise<RankResult> {
  const v = await getViewer();
  if (!v) return fail("Session expirée.");
  const c = await loadChallenge(input.id);
  if (!c?.match) return fail("Aucun résultat à confirmer.");
  const r = await answerMatchResult(v.id, c.match.id, input.confirm, input.reason);
  if (r.ok) {
    refresh(c.game);
    revalidatePath("/arbitrage");
  }
  return r;
}
