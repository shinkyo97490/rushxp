"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { getGame } from "@/lib/data/games";
import { freezeSeeding, generateBracket } from "@/lib/playoffs";
import { logEvent } from "@/lib/matches/room";
import { notifyEntity } from "@/lib/rankings/engine";

type R = { ok: true; message?: string } | { ok: false; errors: Record<string, string> };
const fail = (m: string): R => ({ ok: false, errors: { _: m } });
const currentYear = () => Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion", year: "numeric" }).format(new Date()));

async function admin() {
  const v = await getViewer();
  return v?.role === "admin" ? v : null;
}
function refresh() {
  revalidatePath("/admin");
  revalidatePath("/playoffs");
  revalidatePath("/calendrier");
}

export async function freezeSeedingAction(game: string): Promise<R> {
  const v = await admin();
  if (!v) return fail("Réservé aux administrateurs.");
  if (getGame(game)?.kind !== "challenge") return fail("Jeu inconnu.");
  const year = currentYear();
  if (await db.seedSnapshot.findUnique({ where: { game_year: { game, year } } })) return fail("Seeding déjà figé : il est immuable.");
  const s = await freezeSeeding(game, year);
  await db.auditLog.create({ data: { actorId: v.id, action: "playoffs.seed", target: `seed:${game}:${year}`, after: { hash: s.hash, rows: s.rows as object[] } } });
  refresh();
  return { ok: true, message: `Seeding ${getGame(game)?.name} figé (${(s.rows as unknown[]).length} qualifiés).` };
}

export async function generateBracketAction(game: string): Promise<R> {
  const v = await admin();
  if (!v) return fail("Réservé aux administrateurs.");
  const r = await generateBracket(game, currentYear());
  if (r.error) return fail(r.error);
  await db.auditLog.create({ data: { actorId: v.id, action: "playoffs.bracket", target: `bracket:${game}:${currentYear()}`, after: { created: r.created } } });
  refresh();
  return { ok: true, message: `${r.created} quart(s) de finale créé(s).` };
}

/** Date d'un match de Playoffs (heure de La Réunion). Les deux camps sont prévenus. */
export async function setMatchDateAction(input: { matchId: string; at: string }): Promise<R> {
  const v = await admin();
  if (!v) return fail("Réservé aux administrateurs.");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.at)) return fail("Date invalide.");
  const m = await db.match.findUnique({ where: { id: input.matchId } });
  if (!m || m.type !== "PLAYOFF") return fail("Match introuvable.");
  if (!["SCHEDULED", "CHECK_IN"].includes(m.status)) return fail("Match déjà commencé.");
  const at = new Date(`${input.at}:00+04:00`);
  await db.match.update({ where: { id: m.id }, data: { scheduledAt: at, checkInA: null, checkInB: null, status: "SCHEDULED" } });
  const when = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Indian/Reunion" }).format(at);
  await logEvent(m.id, "SYSTEM", `Date fixée par l’organisation : ${when}.`);
  for (const id of [m.a, m.b]) await notifyEntity(m.game, id, `Playoffs : votre match est fixé au ${when}.`, `/match?m=${m.id}`);
  refresh();
  return { ok: true, message: `Date enregistrée : ${when}.` };
}
