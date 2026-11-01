import "server-only";
import { db } from "@/lib/db";
import type { Viewer } from "@/lib/auth/viewer";
import { getGame, isSolo } from "@/lib/data/games";
import { daysBetween, seriesScores } from "@/lib/rules/rankings";
import { PLACEMENT_MATCHES } from "@/lib/rules/elo";
import { DIVISION_SIZE, type ChallengeItem, type RankingRow } from "@/lib/rankings-model";
import { settleDue } from "./engine";

const fmtSlot = (d: Date) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Indian/Reunion", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    .format(d)
    .replace(/^./, (c) => c.toUpperCase());
const fmtDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Indian/Reunion", day: "numeric", month: "short" }).format(d);

function ago(d: Date, now: Date) {
  const h = Math.floor((now.getTime() - d.getTime()) / 36e5);
  return h < 1 ? "à l’instant" : h < 48 ? `il y a ${h} h` : `il y a ${Math.floor(h / 24)} j`;
}
function inHours(d: Date, now: Date) {
  return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 36e5));
}

/** Nom affiché, structure et état du roster de chaque participant (roster en équipe, joueur en 1v1). */
export async function describeEntities(game: string, ids: string[]) {
  const g = getGame(game);
  const out = new Map<string, { name: string; team?: string; structureId: string | null; structureName: string | null; complete: boolean; captainId: string | null; staff: string[] }>();
  if (!ids.length) return out;
  if (g && isSolo(g)) {
    const users = await db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, pseudo: true, contracts: { where: { leftAt: null }, select: { structure: { select: { id: true, name: true } } }, take: 1 } },
    });
    for (const u of users) {
      const s = u.contracts[0]?.structure ?? null;
      out.set(u.id, { name: u.pseudo, team: s?.name, structureId: s?.id ?? null, structureName: s?.name ?? null, complete: true, captainId: u.id, staff: [] });
    }
  } else {
    const rosters = await db.roster.findMany({
      where: { id: { in: ids } },
      include: { structure: { select: { id: true, name: true, staff: { select: { userId: true } } } }, members: { where: { leftAt: null, role: "STARTER" }, select: { userId: true } } },
    });
    for (const r of rosters)
      out.set(r.id, {
        name: r.structure.name,
        team: r.name !== r.structure.name ? r.name : undefined,
        structureId: r.structure.id,
        structureName: r.structure.name,
        complete: r.members.length >= (g?.rosterSize ?? 1),
        captainId: r.captainId,
        staff: r.structure.staff.map((s) => s.userId),
      });
  }
  return out;
}

/** Entités que le visiteur représente pour ce jeu : lui-même (1v1) ou ses rosters (membre, capitaine ou gestionnaire). */
export async function myEntities(game: string, viewer: Viewer) {
  const g = getGame(game);
  if (g && isSolo(g)) return [{ id: viewer.id, canAct: true, label: viewer.pseudo }];
  const rosters = await db.roster.findMany({
    where: { game, OR: [{ captainId: viewer.id }, { members: { some: { userId: viewer.id, leftAt: null } } }, { structure: { staff: { some: { userId: viewer.id } } } }] },
    include: { structure: { select: { name: true, staff: { select: { userId: true } } } }, members: { where: { userId: viewer.id, leftAt: null }, select: { userId: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rosters
    .map((r) => ({
      id: r.id,
      member: r.members.length > 0,
      canAct: r.captainId === viewer.id || r.structure.staff.some((s) => s.userId === viewer.id),
      label: r.name === r.structure.name ? r.name : `${r.structure.name} · ${r.name}`,
    }))
    .sort((a, b) => Number(b.member) - Number(a.member));
}

/** Classement d'un jeu, à partir de la base. */
export async function rankingRows(game: string, meIds: string[] = [], now = new Date()): Promise<RankingRow[]> {
  const g = getGame(game);
  const entries = await db.rankingEntry.findMany({ where: { game }, orderBy: [{ score: "desc" }, { createdAt: "asc" }] });
  const info = await describeEntities(game, entries.map((e) => e.entityId));
  const list = entries.filter((e) => info.has(e.entityId));
  const nDiv = Math.max(1, Math.ceil(list.length / DIVISION_SIZE));
  const meId = meIds.find((id) => list.some((e) => e.entityId === id));
  return list.map((e, i) => {
    const it = info.get(e.entityId)!;
    const inPlacement = e.placementMatches < PLACEMENT_MATCHES;
    return {
      id: e.entityId,
      name: it.name,
      team: it.team,
      structureId: it.structureId ?? "",
      score: e.score,
      rank: i + 1,
      prevRank: e.prevRank ?? i + 1,
      placementMatches: e.placementMatches,
      wins: e.wins,
      losses: e.losses,
      daysSinceMatch: daysBetween(e.lastMatchAt ?? e.createdAt, now),
      rosterComplete: g && isSolo(g) ? true : it.complete,
      division: inPlacement ? nDiv : Math.min(nDiv, Math.floor(i / DIVISION_SIZE) + 1),
      isMe: e.entityId === meId,
      inPlacement,
      immuneUntil: e.immunityUntil?.toISOString() ?? null,
    };
  });
}

/** Défis de l'entité, mis en forme pour le Centre des défis. */
export async function challengeItems(game: string, entityId: string, now = new Date()): Promise<ChallengeItem[]> {
  const g = getGame(game);
  const list = await db.challenge.findMany({
    where: { game, OR: [{ challengerId: entityId }, { defenderId: entityId }], createdAt: { gte: new Date(now.getTime() - 90 * 86_400_000) } },
    include: { match: { include: { submissions: { orderBy: { createdAt: "desc" }, take: 1 } } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  return list.map((c): ChallengeItem => {
    const dir = c.challengerId === entityId ? "out" : "in";
    const oppId = dir === "out" ? c.defenderId : c.challengerId;
    const m = c.match;
    const sub = m?.submissions[0];
    const amA = m ? m.a === entityId : dir === "out";
    let meta = "";
    let result: string | undefined;
    let canConfirm = false;
    switch (c.status) {
      case "PENDING":
        meta = dir === "in" ? `Reçu ${ago(c.createdAt, now)} · réponse sous ${inHours(c.respondBy, now)} h` : `Envoyé ${ago(c.createdAt, now)} · réponse attendue sous ${inHours(c.respondBy, now)} h`;
        if (c.origin === "AUTO") meta = `Appariement de placement · ${meta}`;
        break;
      case "PLANNED":
        meta = "Créneau confirmé · ajouté au calendrier";
        break;
      case "SUBMITTED": {
        const mine = sub?.uploaderId && sub.status === "AWAITING_OPPONENT" ? sub : null;
        const declaredWin = sub && sub.declaredA != null && sub.declaredB != null ? (amA ? sub.declaredA > sub.declaredB : sub.declaredB > sub.declaredA) : null;
        const score = sub ? `${Math.max(sub.declaredA ?? 0, sub.declaredB ?? 0)}–${Math.min(sub.declaredA ?? 0, sub.declaredB ?? 0)}` : "";
        meta = `Résultat déclaré : ${declaredWin ? "victoire" : "défaite"} ${score} · validation automatique sous ${inHours(new Date((sub?.createdAt ?? now).getTime() + 24 * 36e5), now)} h sans réponse`;
        canConfirm = !!mine;
        break;
      }
      case "DISPUTED":
        meta = "Contesté · résultat suspendu jusqu’à décision d’un arbitre";
        break;
      case "DONE":
        if (m?.winner) {
          const won = m.winner === entityId;
          const d = amA ? m.deltaA : m.deltaB;
          meta = `Validé le ${fmtDate(m.playedAt ?? c.createdAt)}${m.counted ? "" : " · non compté (3e match de la paire en 30 jours)"}`;
          result = `${won ? "Victoire" : "Défaite"} ${Math.max(m.scoreA ?? 0, m.scoreB ?? 0)}–${Math.min(m.scoreA ?? 0, m.scoreB ?? 0)} · ${d != null && d >= 0 ? "+" : "−"}${Math.abs(d ?? 0)} pts`;
        }
        break;
      case "REFUSED":
        meta = c.refusalReason ? `Refusé · ${c.refusalReason}` : "Refusé avec motif admis · aucune pénalité";
        break;
      case "FORFEIT":
        meta = dir === "in" ? "Refus injustifié · forfait et −40 pts appliqués" : "Forfait adverse · refus injustifié";
        break;
      case "EXPIRED":
        meta = "Expiré sans réponse sous 48 h";
        break;
      case "CANCELLED":
        meta = "Annulé par le challenger";
        break;
    }
    return {
      id: c.id,
      dir,
      oppId,
      status: c.status,
      origin: c.origin === "AUTO" ? "auto" : "manual",
      meta,
      slots: c.proposedSlots.map(fmtSlot),
      slotIsos: c.proposedSlots.map((d) => d.toISOString()),
      slot: c.slot ? fmtSlot(c.slot) : undefined,
      slotIso: c.slot?.toISOString(),
      result,
      playedAt: m?.playedAt?.toISOString(),
      matchId: m?.id,
      canConfirm,
      canDeclare: c.status === "PLANNED" && !!c.slot && c.slot <= now,
      scores: seriesScores(g?.series),
    };
  });
}

/** Tout ce qu'il faut à la page Rankings d'un jeu, après avoir réglé les échéances dues. */
export async function loadRankingsPage(game: string, viewer: Viewer | null) {
  await settleDue(game);
  const now = new Date();
  const mine = viewer ? await myEntities(game, viewer) : [];
  const rows = await rankingRows(game, mine.map((m) => m.id), now);
  const me = rows.find((r) => r.isMe) ?? null;
  const meEntity = me ? mine.find((m) => m.id === me.id)! : null;
  const challenges = me ? await challengeItems(game, me.id, now) : [];
  const enterable = mine.filter((m) => m.canAct && !rows.some((r) => r.id === m.id));
  return { rows, me, canAct: !!meEntity?.canAct, challenges, enterable };
}

/** Défis reçus en attente pour l'en-tête (tous jeux). */
export async function pendingReceivedCount(viewer: Viewer) {
  const rosters = await db.roster.findMany({
    where: { OR: [{ captainId: viewer.id }, { structure: { staff: { some: { userId: viewer.id } } } }] },
    select: { id: true },
  });
  return db.challenge.count({ where: { status: "PENDING", defenderId: { in: [viewer.id, ...rosters.map((r) => r.id)] } } });
}
