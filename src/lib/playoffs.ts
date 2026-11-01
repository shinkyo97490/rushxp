import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { CHALLENGE_GAMES, getGame } from "@/lib/data/games";
import { getSeason } from "@/lib/season";
import { rankingRows } from "@/lib/rankings/queries";
import { notifyEntity } from "@/lib/rankings/engine";
import { namesFor } from "@/lib/matches/queries";
import { qualifiers, quarterFinals, ROUND_LABEL, type SeedRow } from "@/lib/rules/playoffs";

/** Fige le seeding d'un jeu : instantané immuable (horodatage + empreinte SHA-256). */
export async function freezeSeeding(game: string, year: number) {
  const existing = await db.seedSnapshot.findUnique({ where: { game_year: { game, year } } });
  if (existing) return existing;
  const rows = qualifiers(await rankingRows(game));
  const takenAt = new Date();
  const hash = createHash("sha256").update(JSON.stringify({ game, year, takenAt: takenAt.toISOString(), rows })).digest("hex");
  const snap = await db.seedSnapshot.create({ data: { game, year, takenAt, hash, rows: rows as object[] } });
  for (const r of rows) await notifyEntity(game, r.entityId, `Seeding figé : vous êtes tête de série n° ${r.seed} des Playoffs ${getGame(game)?.name}.`, `/playoffs?jeu=${game}`);
  return snap;
}

/** Quarts de finale depuis le seeding figé. Dates par défaut : à partir du 2e samedi des Playoffs, 20:00. */
export async function generateBracket(game: string, year: number) {
  const snap = await db.seedSnapshot.findUnique({ where: { game_year: { game, year } } });
  if (!snap) return { created: 0, error: "Seeding non figé." };
  if (await db.match.count({ where: { game, seasonYear: year, type: "PLAYOFF" } })) return { created: 0, error: "Tableau déjà généré." };
  const seeds = snap.rows as unknown as SeedRow[];
  const season = await getSeason(year);
  const start = season.phases.find((p) => p.kind === "PLAYOFFS")?.startsAt ?? new Date(`${year}-09-01T00:00:00+04:00`);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion" }).format(start);
  const base = new Date(`${day}T20:00:00+04:00`).getTime() + 13 * 86_400_000;
  const g = getGame(game);
  let created = 0;
  for (const [i, qf] of quarterFinals(seeds).entries()) {
    if (!qf.a || !qf.b) continue; // moins de 8 qualifiés : la tête de série passe au tour suivant (à arbitrer)
    await db.match.create({
      data: { game, type: "PLAYOFF", a: qf.a.entityId, b: qf.b.entityId, series: g?.series ?? "BO3", scheduledAt: new Date(base + i * 86_400_000), round: qf.round, seasonYear: year },
    });
    created++;
  }
  return { created, error: null };
}

/** Données de la page Playoffs : seeding figé (ou aperçu provisoire) et matchs du tableau. */
export async function getPlayoffs(game: string, year: number) {
  const snap = await db.seedSnapshot.findUnique({ where: { game_year: { game, year } } });
  const seeds: SeedRow[] = snap ? (snap.rows as unknown as SeedRow[]) : qualifiers(await rankingRows(game));
  const matches = await db.match.findMany({ where: { game, seasonYear: year, type: "PLAYOFF" }, orderBy: { scheduledAt: "asc" } });
  const names = await namesFor(matches);
  const seedOf = new Map(seeds.map((s) => [s.entityId, s.seed]));
  const byRound = new Map(matches.map((m) => [m.round ?? "", m]));
  const side = (id: string | null, fallback: string) => (id ? { seed: seedOf.get(id) ?? null, name: names.get(id)?.name ?? seeds.find((s) => s.entityId === id)?.name ?? "?" } : { seed: null, name: fallback });
  const box = (round: string, fa: string, fb: string, plannedA?: SeedRow | null, plannedB?: SeedRow | null) => {
    const m = byRound.get(round);
    const a = m ? side(m.a, fa) : plannedA ? { seed: plannedA.seed, name: plannedA.name } : { seed: null, name: fa };
    const b = m ? side(m.b, fb) : plannedB ? { seed: plannedB.seed, name: plannedB.name } : { seed: null, name: fb };
    const done = m?.status === "DONE";
    return {
      round,
      label: ROUND_LABEL[round],
      id: m?.id ?? null,
      when: m ? m.scheduledAt.toISOString() : null,
      state: !m ? "En attente" : done ? "Terminé" : m.status === "SUBMITTED" ? "Résultat en attente" : m.status === "DISPUTED" ? "Contesté" : "Programmé",
      sides: [
        { ...a, score: m?.scoreA ?? undefined, win: done ? m!.winner === m!.a : undefined },
        { ...b, score: m?.scoreB ?? undefined, win: done ? m!.winner === m!.b : undefined },
      ] as const,
    };
  };
  const qfs = quarterFinals(seeds);
  const qf = qfs.map((q, i) => box(q.round, `Tête de série ${[1, 4, 2, 3][i]}`, `Tête de série ${[8, 5, 7, 6][i]}`, q.a, q.b));
  const sf = [box("SF1", "Vainqueur QF1", "Vainqueur QF2"), box("SF2", "Vainqueur QF3", "Vainqueur QF4")];
  const fi = [box("F", "Vainqueur DF1", "Vainqueur DF2")];
  const champion = byRound.get("F")?.status === "DONE" ? side(byRound.get("F")!.winner!, "") : null;
  const lost = new Set(matches.filter((m) => m.status === "DONE").map((m) => (m.winner === m.a ? m.b : m.a)));
  const alive = new Map<string, string>();
  for (const m of matches) for (const id of [m.a, m.b]) alive.set(id, m.round ?? "");
  return {
    frozen: snap ? { at: snap.takenAt.toISOString(), hash: snap.hash } : null,
    seeds: seeds.map((s) => ({ ...s, state: lost.has(s.entityId) ? "Éliminé" : champion && seedOf.get(s.entityId) === champion.seed ? "Champion" : alive.get(s.entityId)?.startsWith("F") ? "En finale" : alive.get(s.entityId)?.startsWith("SF") ? "En demi-finale" : "En lice" })),
    qf,
    sf,
    fi,
    champion,
    generated: matches.length > 0,
  };
}

/** Tâche quotidienne : seeding figé à la date de référence (dans les 7 jours qui suivent), puis tableau. */
export async function dailyPlayoffs(now = new Date()) {
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion", year: "numeric" }).format(now));
  const season = await getSeason(year);
  const late = now.getTime() - season.seedingAt.getTime();
  if (late < 0 || late > 7 * 86_400_000) return { year, frozen: 0 };
  let frozen = 0;
  for (const g of CHALLENGE_GAMES) {
    if (!(await db.seedSnapshot.findUnique({ where: { game_year: { game: g.id, year } } }))) {
      await freezeSeeding(g.id, year);
      frozen++;
    }
    await generateBracket(g.id, year);
  }
  return { year, frozen };
}
