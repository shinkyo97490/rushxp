import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { CHALLENGE_GAMES, GAMES } from "@/lib/data/games";
import { getSeasonContext } from "@/lib/season";
import { lanStructurePoints } from "@/lib/rules/scales";
import { structureStandings, type RankedRoster } from "@/lib/rules/standings";
import { rankingRows } from "./queries";

/**
 * Classement général des structures de la saison en cours :
 * Rankings (rang actuel de chaque roster), cumul des RDV mensuels comptés, et LAN terminées.
 */
export const getGeneralStandings = cache(async () => {
  const { season, phase } = await getSeasonContext(new Date());
  const rosters: RankedRoster[] = [];
  for (const g of CHALLENGE_GAMES) {
    for (const r of await rankingRows(g.id)) if (r.structureId) rosters.push({ game: g.id, rank: r.rank, structureId: r.structureId, inPlacement: r.inPlacement });
  }

  // RDV mensuels : cumul des points sur les mois qui comptent (hors pré-saison), par structure.
  const counted = season.phases.filter((p) => p.countsForGeneral);
  const results = await db.eventResult.findMany({
    where: { round: { event: { date: { gte: new Date(`${season.year}-01-01T00:00:00+04:00`), lt: new Date(`${season.year + 1}-01-01T00:00:00+04:00`) } } } },
    include: { entry: { select: { entityId: true, event: { select: { game: true, date: true } } } } },
  });
  const perEntity = new Map<string, { game: string; entityId: string; points: number }>();
  for (const r of results) {
    const d = r.entry.event.date;
    if (!counted.some((p) => d >= p.startsAt && d <= p.endsAt)) continue;
    const k = `${r.entry.event.game}:${r.entry.entityId}`;
    const cur = perEntity.get(k) ?? { game: r.entry.event.game, entityId: r.entry.entityId, points: 0 };
    cur.points += r.points;
    perEntity.set(k, cur);
  }
  const ids = [...new Set([...perEntity.values()].map((e) => e.entityId))];
  const [rs, contracts] = await Promise.all([
    db.roster.findMany({ where: { id: { in: ids } }, select: { id: true, structureId: true } }),
    db.structureMember.findMany({ where: { userId: { in: ids }, leftAt: null }, select: { userId: true, structureId: true } }),
  ]);
  const structOf = new Map<string, string>([...rs.map((r) => [r.id, r.structureId] as const), ...contracts.map((c) => [c.userId, c.structureId] as const)]);
  for (const game of new Set([...perEntity.values()].map((e) => e.game))) {
    // Par structure, son meilleur total sur le jeu, puis rang entre structures.
    const best = new Map<string, number>();
    for (const e of perEntity.values()) {
      const s = structOf.get(e.entityId);
      if (e.game !== game || !s) continue;
      best.set(s, Math.max(best.get(s) ?? 0, e.points));
    }
    [...best.entries()].sort((a, b) => b[1] - a[1]).forEach(([structureId], i) => rosters.push({ game, rank: i + 1, structureId }));
  }

  // LAN terminées de la saison qui comptent au classement.
  const lans = await db.lanEvent.findMany({
    where: { status: "DONE", countsForGeneral: true, startsAt: { gte: new Date(`${season.year}-01-01T00:00:00+04:00`), lt: new Date(`${season.year + 1}-01-01T00:00:00+04:00`) } },
    include: { tournaments: { include: { results: true } } },
  });
  const extra = lans.flatMap((l) =>
    lanStructurePoints(l.tournaments.flatMap((t) => t.results.map((r) => ({ game: t.game, place: r.place, structure: r.structureId })))).map((p) => ({ structureId: p.structure, key: "lan", points: p.points })),
  );

  const standings = structureStandings(rosters, extra);
  const structures = await db.structure.findMany({ where: { id: { in: standings.map((s) => s.structureId) } }, select: { id: true, name: true, tag: true, logoUrl: true } });
  const byId = new Map(structures.map((s) => [s.id, s]));
  return {
    indicative: !phase?.countsForGeneral,
    phaseLabel: phase?.label ?? "",
    list: standings.filter((s) => byId.has(s.structureId)).map((s) => ({ ...s, structure: byId.get(s.structureId)! })),
    columns: [...GAMES.map((g) => ({ key: g.id, short: g.short, name: g.name })), { key: "lan", short: "LAN", name: "LAN & événements" }],
  };
});
