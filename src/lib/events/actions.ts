"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { EVENT_FORMATS } from "@/lib/data/content";
import { ensureNextEvent } from "./queries";

export type EventResult = { ok: true; message?: string } | { ok: false; errors: Record<string, string> };
const fail = (m: string): EventResult => ({ ok: false, errors: { _: m } });
type LobbyGame = "tft" | "wz" | "apex";

/** Inscription : solo = le joueur ; duo / trio = un roster de la structure, inscrit par son capitaine ou un gestionnaire. */
export async function registerEventAction(input: { game: LobbyGame; rosterId?: string }): Promise<EventResult> {
  const v = await getViewer();
  if (!v) return fail("Connectez-vous pour vous inscrire.");
  if (!(input.game in EVENT_FORMATS)) return fail("Jeu inconnu.");
  const ev = await ensureNextEvent(input.game);
  if (ev.status !== "OPEN") return fail("Les inscriptions sont fermées.");
  // Inscriptions jusqu'au jeudi précédent, 23:59.
  const deadline = new Date(ev.date.getTime() - 2 * 86_400_000);
  deadline.setHours(23, 59, 59, 0);
  if (new Date() > deadline) return fail("Les inscriptions sont closes (jeudi précédent, 23:59).");
  const count = await db.eventEntry.count({ where: { eventId: ev.id } });
  if (count >= ev.capacity) return fail("Complet : plus aucune place disponible.");
  const solo = EVENT_FORMATS[input.game].size === 1;

  let entityId: string;
  let members: string[];
  if (solo) {
    entityId = v.id;
    members = [v.id];
  } else {
    if (!input.rosterId) return fail("Choisissez l’équipe à inscrire.");
    const roster = await db.roster.findUnique({
      where: { id: input.rosterId },
      include: { members: { where: { leftAt: null }, select: { userId: true, role: true } }, structure: { select: { staff: { select: { userId: true } } } } },
    });
    if (!roster || roster.game !== input.game) return fail("Équipe introuvable pour ce jeu.");
    const allowed = roster.captainId === v.id || roster.structure.staff.some((s) => s.userId === v.id);
    if (!allowed) return fail("Seul le capitaine ou un gestionnaire inscrit l’équipe.");
    const starters = roster.members.filter((m) => m.role === "STARTER");
    if (starters.length < EVENT_FORMATS[input.game].size) return fail(`Équipe incomplète : ${EVENT_FORMATS[input.game].size} titulaires requis.`);
    entityId = roster.id;
    members = starters.map((m) => m.userId);
  }
  const existing = await db.eventEntry.findUnique({ where: { eventId_entityId: { eventId: ev.id, entityId } } });
  if (existing) return fail("Déjà inscrit à ce rendez-vous.");
  await db.eventEntry.create({ data: { eventId: ev.id, entityId, members } });
  revalidatePath("/rdv");
  return { ok: true, message: "✓ Inscription enregistrée. Check-in obligatoire le jour J." };
}

export async function unregisterEventAction(input: { game: LobbyGame; entityId: string }): Promise<EventResult> {
  const v = await getViewer();
  if (!v) return fail("Session expirée.");
  const ev = await ensureNextEvent(input.game);
  const entry = await db.eventEntry.findUnique({ where: { eventId_entityId: { eventId: ev.id, entityId: input.entityId } } });
  if (!entry) return fail("Inscription introuvable.");
  let allowed = entry.entityId === v.id;
  if (!allowed) {
    const roster = await db.roster.findUnique({ where: { id: entry.entityId }, include: { structure: { select: { staff: { select: { userId: true } } } } } });
    allowed = !!roster && (roster.captainId === v.id || roster.structure.staff.some((s) => s.userId === v.id));
  }
  if (!allowed) return fail("Action non autorisée.");
  await db.eventEntry.delete({ where: { id: entry.id } });
  revalidatePath("/rdv");
  return { ok: true, message: "Désinscription enregistrée : la place est libérée." };
}
