import "server-only";
import { db } from "@/lib/db";
import { getGame, isSolo } from "@/lib/data/games";

const MVP_VOTE_HOURS = 48;

/** Joueurs ayant pris part à un match : le joueur en 1v1, sinon les membres du roster à la date du match. */
export async function matchPlayers(m: { game: string; a: string; b: string; playedAt: Date | null; scheduledAt: Date }) {
  const g = getGame(m.game);
  const at = m.playedAt ?? m.scheduledAt;
  const out: { userId: string; side: "a" | "b" }[] = [];
  for (const side of ["a", "b"] as const) {
    const id = m[side];
    if (g && isSolo(g)) out.push({ userId: id, side });
    else {
      const ms = await db.rosterMember.findMany({ where: { rosterId: id, joinedAt: { lte: at }, OR: [{ leftAt: null }, { leftAt: { gt: at } }] }, select: { userId: true } });
      for (const x of ms) out.push({ userId: x.userId, side });
    }
  }
  return out;
}

/** MVP élu d'un match : le plus de votes ; égalité départagée en faveur du camp vainqueur, puis du premier vote. */
export function electMvp(votes: { playerId: string; createdAt: Date }[], winnerSidePlayers: Set<string>) {
  const tally = new Map<string, { n: number; first: number }>();
  for (const v of votes) {
    const t = tally.get(v.playerId) ?? { n: 0, first: v.createdAt.getTime() };
    tally.set(v.playerId, { n: t.n + 1, first: Math.min(t.first, v.createdAt.getTime()) });
  }
  return [...tally.entries()].sort((x, y) => y[1].n - x[1].n || Number(winnerSidePlayers.has(y[0])) - Number(winnerSidePlayers.has(x[0])) || x[1].first - y[1].first)[0]?.[0] ?? null;
}

export async function mvpPanel(matchId: string, viewerId: string | null) {
  const m = await db.match.findUnique({ where: { id: matchId }, include: { mvpVotes: true } });
  if (!m || m.status !== "DONE" || !m.playedAt) return null;
  const players = await matchPlayers(m);
  const users = await db.user.findMany({ where: { id: { in: players.map((p) => p.userId) } }, select: { id: true, pseudo: true } });
  const open = Date.now() < m.playedAt.getTime() + MVP_VOTE_HOURS * 36e5;
  const winnerSide = m.winner === m.a ? "a" : "b";
  const mvp = open ? null : electMvp(m.mvpVotes, new Set(players.filter((p) => p.side === winnerSide).map((p) => p.userId)));
  return {
    open,
    canVote: !!viewerId && open && players.some((p) => p.userId === viewerId),
    myVote: m.mvpVotes.find((v) => v.voterId === viewerId)?.playerId ?? null,
    votes: m.mvpVotes.length,
    mvp: mvp ? users.find((u) => u.id === mvp)?.pseudo ?? null : null,
    candidates: players.filter((p) => p.userId !== viewerId).map((p) => ({ id: p.userId, side: p.side, pseudo: users.find((u) => u.id === p.userId)?.pseudo ?? "Joueur" })),
  };
}

/** Classement individuel de la saison : MVP, matchs et victoires (tous jeux, ou un jeu). */
export async function playerLeaderboard(year: number, game?: string) {
  const from = new Date(`${year}-01-01T00:00:00+04:00`);
  const to = new Date(`${year + 1}-01-01T00:00:00+04:00`);
  const matches = await db.match.findMany({ where: { status: "DONE", playedAt: { gte: from, lt: to }, ...(game ? { game } : {}) }, include: { mvpVotes: true } });
  const stats = new Map<string, { mvp: number; played: number; wins: number; games: Set<string> }>();
  const cutoff = Date.now() - MVP_VOTE_HOURS * 36e5;
  for (const m of matches) {
    const players = await matchPlayers(m);
    const winnerSide = m.winner === m.a ? "a" : "b";
    for (const p of players) {
      const s = stats.get(p.userId) ?? { mvp: 0, played: 0, wins: 0, games: new Set<string>() };
      s.played++;
      if (p.side === winnerSide) s.wins++;
      s.games.add(m.game);
      stats.set(p.userId, s);
    }
    if (m.playedAt!.getTime() <= cutoff) {
      const mvp = electMvp(m.mvpVotes, new Set(players.filter((p) => p.side === winnerSide).map((p) => p.userId)));
      if (mvp && stats.has(mvp)) stats.get(mvp)!.mvp++;
    }
  }
  const users = await db.user.findMany({
    where: { id: { in: [...stats.keys()] } },
    select: { id: true, pseudo: true, contracts: { where: { leftAt: null }, select: { structure: { select: { name: true } } }, take: 1 } },
  });
  return users
    .map((u) => {
      const s = stats.get(u.id)!;
      return { id: u.id, pseudo: u.pseudo, team: u.contracts[0]?.structure.name ?? "Agent libre", mvp: s.mvp, played: s.played, wins: s.wins, games: [...s.games] };
    })
    .sort((a, b) => b.mvp - a.mvp || b.wins / Math.max(1, b.played) - a.wins / Math.max(1, a.played) || b.played - a.played || a.pseudo.localeCompare(b.pseudo));
}
