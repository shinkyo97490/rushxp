"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { validatePool, type VetoPool } from "@/lib/rules/veto";

type R = { ok: true; message?: string } | { ok: false; errors: Record<string, string> };
const fail = (m: string, f = "_"): R => ({ ok: false, errors: { [f]: m } });

/**
 * Nouveau cycle de cartes : actif à 00:00 (heure de La Réunion) le jour choisi.
 * Un veto déjà commencé garde le pool figé à son début.
 */
export async function createCycleAction(input: { game: string; name: string; startsOn: string; maps: VetoPool }): Promise<R> {
  const v = await getViewer();
  if (v?.role !== "admin") return fail("Réservé aux administrateurs.");
  if (input.game !== "val" && input.game !== "cod") return fail("Jeu sans veto.");
  const name = input.name.trim();
  if (name.length < 3) return fail("Nom du cycle requis (3 caractères minimum).", "name");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn)) return fail("Date invalide.", "startsOn");
  const startsAt = new Date(`${input.startsOn}T00:00:00+04:00`);
  const today = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion" }).format(new Date())}T00:00:00+04:00`);
  if (startsAt < today) return fail("La date d’activation ne peut pas être passée.", "startsOn");
  const err = validatePool(input.game, input.maps);
  if (err) return fail(err, "maps");
  if (await db.mapCycle.findFirst({ where: { game: input.game, startsAt } })) return fail("Un cycle commence déjà ce jour-là.", "startsOn");
  const c = await db.mapCycle.create({ data: { game: input.game, name, startsAt, maps: input.maps as object, createdById: v.id } });
  await db.auditLog.create({ data: { actorId: v.id, action: "mappool.cycle", target: `cycle:${c.id}`, after: { game: input.game, name, startsOn: input.startsOn, maps: input.maps as object } } });
  revalidatePath("/admin");
  return { ok: true, message: `Cycle « ${name} » programmé : actif le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Indian/Reunion" }).format(startsAt)} à 00:00.` };
}

/** Annule un cycle pas encore actif. */
export async function deleteCycleAction(id: string): Promise<R> {
  const v = await getViewer();
  if (v?.role !== "admin") return fail("Réservé aux administrateurs.");
  const c = await db.mapCycle.findUnique({ where: { id } });
  if (!c) return fail("Cycle introuvable.");
  if (c.startsAt <= new Date()) return fail("Un cycle déjà actif ne peut pas être supprimé : programmez-en un nouveau.");
  await db.mapCycle.delete({ where: { id } });
  await db.auditLog.create({ data: { actorId: v.id, action: "mappool.cycle.delete", target: `cycle:${id}`, before: { name: c.name } } });
  revalidatePath("/admin");
  return { ok: true, message: "Cycle programmé supprimé." };
}
