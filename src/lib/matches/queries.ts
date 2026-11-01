import "server-only";
import { db } from "@/lib/db";
import type { Viewer } from "@/lib/auth/viewer";
import { getGame, isSolo } from "@/lib/data/games";
import { describeEntities } from "@/lib/rankings/queries";
import { ROUND_LABEL } from "@/lib/rules/playoffs";

export type MatchState = "Programmé" | "Check-in" | "En direct" | "Résultat en attente" | "Contesté" | "Terminé";

export interface CalendarItem {
  id: string;
  game: string;
  a: string;
  b: string;
  when: Date;
  type: "Défi" | "Playoffs" | "RDV mensuel" | "LAN";
  state: MatchState;
  score?: string;
  comp: string;
  mine: boolean;
  href: string;
}

const CHECKIN_MS = 30 * 60_000;

export function matchState(status: string, scheduledAt: Date, now = new Date()): MatchState {
  if (status === "DONE") return "Terminé";
  if (status === "DISPUTED") return "Contesté";
  if (status === "SUBMITTED") return "Résultat en attente";
  if (status === "LIVE") return "En direct";
  if (status === "CHECK_IN" || (scheduledAt.getTime() - now.getTime() < CHECKIN_MS && scheduledAt.getTime() > now.getTime() - 3 * 36e5)) return now >= scheduledAt ? "En direct" : "Check-in";
  return "Programmé";
}

/** Toutes les entités (joueur + rosters) que représente un utilisateur, tous jeux confondus. */
export async function viewerEntityIds(viewer: Viewer | null): Promise<Set<string>> {
  if (!viewer) return new Set();
  const rosters = await db.roster.findMany({
    where: { OR: [{ captainId: viewer.id }, { members: { some: { userId: viewer.id, leftAt: null } } }, { structure: { staff: { some: { userId: viewer.id } } } }] },
    select: { id: true },
  });
  return new Set([viewer.id, ...rosters.map((r) => r.id)]);
}

/** Noms des deux camps d'une liste de matchs, groupés par jeu. */
export async function namesFor(matches: { game: string; a: string; b: string }[]) {
  const byGame = new Map<string, Set<string>>();
  for (const m of matches) byGame.set(m.game, (byGame.get(m.game) ?? new Set()).add(m.a).add(m.b));
  const names = new Map<string, { name: string; tag: string; structureId: string | null }>();
  for (const [game, ids] of byGame) {
    const info = await describeEntities(game, [...ids]);
    for (const [id, it] of info) {
      const name = it.team ? (isSolo(getGame(game)!) ? it.name : `${it.name} · ${it.team}`) : it.name;
      names.set(id, { name, tag: (it.structureName ?? it.name).replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase(), structureId: it.structureId });
    }
  }
  return names;
}

/** Calendrier : matchs (défis, Playoffs), RDV mensuels et LAN, entre deux dates. */
export async function calendarItems(opts: { viewer: Viewer | null; from: Date; to: Date; game?: string }): Promise<CalendarItem[]> {
  const now = new Date();
  const mineIds = await viewerEntityIds(opts.viewer);
  const matches = await db.match.findMany({
    where: { scheduledAt: { gte: opts.from, lte: opts.to }, status: { not: "CANCELLED" }, ...(opts.game ? { game: opts.game } : {}) },
    orderBy: { scheduledAt: "asc" },
    take: 300,
  });
  const names = await namesFor(matches);
  const items: CalendarItem[] = matches.map((m) => {
    const g = getGame(m.game);
    const state = matchState(m.status, m.scheduledAt, now);
    return {
      id: m.id,
      game: m.game,
      a: names.get(m.a)?.name ?? "À déterminer",
      b: names.get(m.b)?.name ?? "À déterminer",
      when: m.scheduledAt,
      type: m.type === "PLAYOFF" ? "Playoffs" : "Défi",
      state,
      score: m.scoreA != null && m.scoreB != null ? `${m.scoreA}–${m.scoreB}` : undefined,
      comp: m.type === "PLAYOFF" ? `Playoffs · ${g?.name ?? m.game}${m.round ? ` · ${ROUND_LABEL[m.round] ?? m.round}` : ""}` : `RushXP Rankings · ${g?.name ?? m.game}`,
      mine: mineIds.has(m.a) || mineIds.has(m.b),
      href: state === "Terminé" ? `/feuille-de-match?m=${m.id}` : `/match?m=${m.id}`,
    };
  });

  const events = await db.monthlyEvent.findMany({
    where: { date: { gte: opts.from, lte: opts.to }, status: { not: "CANCELLED" }, ...(opts.game ? { game: opts.game } : {}) },
    include: { _count: { select: { entries: true } }, entries: { select: { entityId: true } } },
  });
  for (const e of events) {
    const g = getGame(e.game);
    items.push({
      id: `rdv-${e.id}`,
      game: e.game,
      a: `RDV ${g?.short ?? e.game}`,
      b: `${e._count.entries} / ${e.capacity} inscrits`,
      when: e.date,
      type: "RDV mensuel",
      state: e.status === "DONE" ? "Terminé" : e.status === "LIVE" ? "En direct" : e.status === "CHECK_IN" ? "Check-in" : "Programmé",
      comp: `Rendez-vous mensuel · ${g?.name ?? e.game}`,
      mine: e.entries.some((x) => mineIds.has(x.entityId)),
      href: `/rdv?jeu=${e.game}`,
    });
  }

  if (!opts.game) {
    const lans = await db.lanEvent.findMany({ where: { status: { in: ["ANNOUNCED", "OPEN", "CLOSED", "DONE"] }, startsAt: { gte: opts.from, lte: opts.to } } });
    for (const l of lans)
      items.push({
        id: `lan-${l.id}`,
        game: "lan",
        a: l.name,
        b: l.place,
        when: l.startsAt!,
        type: "LAN",
        state: l.status === "DONE" ? "Terminé" : "Programmé",
        comp: `LAN · ${l.organizer}`,
        mine: false,
        href: `/lan?e=${l.slug}`,
      });
  }
  return items.sort((x, y) => x.when.getTime() - y.when.getTime());
}

/** Prochains matchs, RDV et LAN (en cours depuis moins de 3 h, ou à venir sous `days` jours). */
export async function upcomingItems(viewer: Viewer | null, days = 30, limit = 4) {
  const now = Date.now();
  const list = await calendarItems({ viewer, from: new Date(now - 3 * 36e5), to: new Date(now + days * 86_400_000) });
  return list.filter((m) => m.state !== "Terminé").slice(0, limit);
}
