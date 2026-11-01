import "server-only";
import { db } from "@/lib/db";
import { CHALLENGE_GAMES } from "@/lib/data/games";
import { rankingRows } from "@/lib/rankings/queries";
import { eventResults } from "@/lib/events/results";
import { electMvp, matchPlayers } from "@/lib/players";
import { readGames } from "@/lib/rules/series";
import { ACHIEVEMENTS, levelFor } from "@/lib/rules/achievements";

const MVP_VOTE_HOURS = 48;

/** Progression brute de chaque succès, calculée sur les données réelles du joueur (toutes saisons). */
async function progress(userId: string): Promise<Record<string, number>> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { bio: true, availability: true } });
  const memberships = await db.rosterMember.findMany({ where: { userId }, select: { rosterId: true } });
  const rosterIds = [...new Set(memberships.map((m) => m.rosterId))];
  const entityIds = [userId, ...rosterIds];

  // Matchs officiels terminés auxquels le joueur a réellement pris part (roster à la date du match).
  const candidates = await db.match.findMany({
    where: { status: "DONE", OR: [{ a: { in: entityIds } }, { b: { in: entityIds } }] },
    include: { mvpVotes: true },
  });
  let played = 0, wins = 0, sweep = 0, comeback = 0, upset = 0, mvp = 0, finalist = 0, champion = 0;
  const cutoff = Date.now() - MVP_VOTE_HOURS * 36e5;
  for (const m of candidates) {
    const players = await matchPlayers(m);
    const me = players.find((p) => p.userId === userId);
    if (!me) continue;
    played++;
    const mySide = me.side;
    const myId = m[mySide];
    const won = m.winner === myId;
    const [mine, theirs] = mySide === "a" ? [m.scoreA ?? 0, m.scoreB ?? 0] : [m.scoreB ?? 0, m.scoreA ?? 0];
    if (won) {
      wins++;
      if (theirs === 0 && mine > 0) sweep++;
      const g = readGames(m.games);
      if (g.length > 1) {
        const first = mySide === "a" ? g[0].a > g[0].b : g[0].b > g[0].a;
        if (!first) comeback++;
      }
      const delta = mySide === "a" ? m.deltaA : m.deltaB;
      if (m.counted && (delta ?? 0) >= 25) upset++;
      if (m.round === "F") champion++;
    }
    if (m.round === "F") finalist++;
    if (m.playedAt && m.playedAt.getTime() <= cutoff) {
      const winnerSide = m.winner === m.a ? "a" : "b";
      if (electMvp(m.mvpVotes, new Set(players.filter((p) => p.side === winnerSide).map((p) => p.userId))) === userId) mvp++;
    }
  }

  const [structure, captain, challenges, rdvEntries, lan, seeds] = await Promise.all([
    db.structureMember.count({ where: { userId } }),
    db.roster.count({ where: { captainId: userId } }),
    db.challenge.count({ where: { challengerId: { in: entityIds }, origin: "MANUAL" } }),
    db.eventEntry.findMany({ where: { OR: [{ entityId: { in: entityIds } }, { members: { has: userId } }], event: { status: { in: ["LIVE", "DONE"] } } }, select: { id: true, eventId: true, event: { select: { status: true } } } }),
    db.lanRegistration.count({ where: { status: "PAID", OR: [{ entityId: { in: entityIds } }, { members: { has: userId } }] } }),
    db.seedSnapshot.findMany({ select: { rows: true } }),
  ]);

  let podium = 0;
  for (const e of rdvEntries.filter((x) => x.event.status === "DONE")) {
    const res = await eventResults(e.eventId);
    const rank = res?.standing.findIndex((s) => s.id === e.id) ?? -1;
    if (rank >= 0 && rank < 3) podium++;
  }

  let division1 = 0;
  for (const g of CHALLENGE_GAMES) {
    const rows = await rankingRows(g.id, entityIds);
    if (rows.length >= 8 && rows.some((r) => r.isMe && r.division === 1 && !r.inPlacement)) division1 = 1;
  }
  const qualified = seeds.some((s) => (s.rows as { entityId: string }[]).some((r) => entityIds.includes(r.entityId)));

  return {
    PROFILE: user?.bio?.trim() && user.availability.length ? 1 : 0,
    STRUCTURE: structure,
    CAPTAIN: captain,
    FIRST_MATCH: played,
    FIRST_WIN: wins,
    MATCHES_25: played,
    WINS_10: wins,
    WINS_50: wins,
    CHALLENGER: challenges,
    SWEEP: sweep,
    COMEBACK: comeback,
    UPSET: upset,
    D1: division1,
    MVP_1: mvp,
    MVP_5: mvp,
    MVP_15: mvp,
    RDV_3: rdvEntries.length,
    RDV_8: rdvEntries.length,
    RDV_PODIUM: podium,
    LAN_1: lan,
    PLAYOFFS: qualified ? 1 : 0,
    FINALIST: finalist,
    CHAMPION: champion,
  };
}

/**
 * Calcule les succès d'un joueur, enregistre ceux qui viennent d'être débloqués (définitifs),
 * crédite l'XP, met à jour le niveau et notifie. Idempotent.
 */
export async function syncAchievements(userId: string) {
  const [cur, owned] = await Promise.all([progress(userId), db.userAchievement.findMany({ where: { userId } })]);
  const have = new Map(owned.map((o) => [o.code, o.unlockedAt]));
  const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.code) && (cur[a.code] ?? 0) >= a.max);
  if (fresh.length) {
    const created = await db.userAchievement.createMany({ data: fresh.map((a) => ({ userId, code: a.code, xp: a.xp })), skipDuplicates: true });
    if (created.count) {
      const total = await db.userAchievement.aggregate({ where: { userId }, _sum: { xp: true } });
      const xp = total._sum.xp ?? 0;
      await db.user.update({ where: { id: userId }, data: { xp, level: levelFor(xp) } });
      await db.notification.createMany({
        data: fresh.map((a) => ({ userId, category: "systeme", text: `Succès débloqué : ${a.title} (+${a.xp} XP).`, link: "/mvp#succes" })),
      });
    }
    const now = new Date();
    for (const a of fresh) have.set(a.code, now);
  }
  return ACHIEVEMENTS.map((a) => {
    const unlockedAt = have.get(a.code) ?? null;
    return { ...a, cur: Math.min(cur[a.code] ?? 0, a.max), done: !!unlockedAt, unlockedAt };
  });
}

/** Succès débloqués d'un joueur (lecture seule, pour son profil public). */
export async function unlockedAchievements(userId: string) {
  const owned = await db.userAchievement.findMany({ where: { userId }, orderBy: { unlockedAt: "desc" } });
  return owned.flatMap((o) => {
    const a = ACHIEVEMENTS.find((x) => x.code === o.code);
    return a ? [{ ...a, unlockedAt: o.unlockedAt }] : [];
  });
}

/** Après un résultat officiel : mise à jour des succès des joueurs du match (sans bloquer). */
export async function syncMatchAchievements(matchId: string) {
  try {
    const m = await db.match.findUnique({ where: { id: matchId } });
    if (!m) return;
    for (const p of await matchPlayers(m)) await syncAchievements(p.userId);
  } catch (e) {
    console.error("Succès non mis à jour", e);
  }
}
