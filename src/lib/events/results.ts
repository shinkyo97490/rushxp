import "server-only";
import { db } from "@/lib/db";
import { getGame } from "@/lib/data/games";
import { LOBBY_SCALES, eventStandingsFrom, type LobbyScale } from "@/lib/rules/scales";

/** Barème d'un jeu en lobby : celui réglé par l'admin (table Game), sinon la valeur par défaut. */
export async function lobbyScale(game: "tft" | "wz" | "apex"): Promise<LobbyScale> {
  const g = await db.game.findUnique({ where: { id: game } });
  const placement = Array.isArray(g?.scale) ? (g!.scale as number[]) : LOBBY_SCALES[game].placement;
  return { placement, pointPerKill: g?.killPoint ?? LOBBY_SCALES[game].pointPerKill };
}

/** Inscrits d'un RDV avec leur nom (joueur, duo ou trio) et les résultats saisis, manche par manche. */
export async function eventResults(eventId: string) {
  const ev = await db.monthlyEvent.findUnique({
    where: { id: eventId },
    include: { entries: true, rounds: { orderBy: { n: "asc" }, include: { results: true } } },
  });
  if (!ev) return null;
  const solo = (getGame(ev.game)?.rosterSize ?? 1) === 1;
  const ids = ev.entries.map((e) => e.entityId);
  const [users, rosters, contracts] = await Promise.all([
    solo ? db.user.findMany({ where: { id: { in: ids } }, select: { id: true, pseudo: true } }) : Promise.resolve([]),
    solo ? Promise.resolve([]) : db.roster.findMany({ where: { id: { in: ids } }, include: { structure: { select: { name: true } } } }),
    solo ? db.structureMember.findMany({ where: { userId: { in: ids }, leftAt: null }, include: { structure: { select: { name: true } } } }) : Promise.resolve([]),
  ]);
  const entries = ev.entries.map((e) => {
    if (solo) {
      const u = users.find((x) => x.id === e.entityId);
      return { id: e.id, name: u?.pseudo ?? "Joueur", sub: contracts.find((c) => c.userId === e.entityId)?.structure.name ?? "Sans structure" };
    }
    const r = rosters.find((x) => x.id === e.entityId);
    return { id: e.id, name: r ? (r.name === r.structure.name ? r.name : `${r.structure.name} · ${r.name}`) : "Équipe", sub: ev.game === "wz" ? "duo" : "trio" };
  });
  const published = ev.rounds.filter((r) => r.status === "PUBLISHED");
  const results = published.flatMap((r) => r.results.map((x) => ({ entryId: x.entryId, round: r.n, placement: x.placement, kills: x.kills, points: x.points })));
  return { ev, solo, entries, standing: eventStandingsFrom(entries, results), publishedRounds: published.map((r) => r.n), allRounds: ev.rounds };
}

/** RDV de la saison pour un jeu (janvier → août), du plus ancien au plus récent. */
export async function seasonEvents(game: string, year: number) {
  return db.monthlyEvent.findMany({ where: { game, month: { gte: `${year}-01`, lte: `${year}-12` } }, orderBy: { month: "asc" } });
}
