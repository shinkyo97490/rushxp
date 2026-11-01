"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { EVENT_FORMATS } from "@/lib/data/content";
import { ensureNextEvent } from "./queries";
import { lobbyScale } from "./results";
import { lobbyPoints } from "@/lib/rules/scales";

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

// ─── Saisie des résultats (arbitres) ─────────────────────────────

/** Saisie d'une manche : placement et éliminations de chaque inscrit. Publiée = comptée au classement. */
export async function saveRoundAction(input: { eventId: string; round: number; rows: { entryId: string; placement: number; kills: number }[]; publish: boolean }): Promise<EventResult> {
  const v = await getViewer();
  if (!v || (v.role !== "admin" && v.role !== "arbitre")) return fail("Réservé aux arbitres.");
  const ev = await db.monthlyEvent.findUnique({ where: { id: input.eventId }, include: { entries: { select: { id: true } } } });
  if (!ev) return fail("Rendez-vous introuvable.");
  if (ev.status === "DONE") return fail("Rendez-vous clôturé : les résultats sont définitifs.");
  if (!Number.isInteger(input.round) || input.round < 1 || input.round > 6) return fail("Manche 1 à 6.");
  const valid = new Set(ev.entries.map((e) => e.id));
  const rows = input.rows.filter((r) => r.placement > 0);
  if (rows.some((r) => !valid.has(r.entryId) || !Number.isInteger(r.placement) || r.placement > 100 || !Number.isInteger(r.kills) || r.kills < 0 || r.kills > 60)) return fail("Valeurs invalides.");
  const lobby = ev.game === "tft" ? 8 : Infinity;
  if (ev.game !== "tft" && new Set(rows.map((r) => r.placement)).size !== rows.length) return fail("Deux inscrits ont la même place.");
  if (rows.some((r) => r.placement > lobby)) return fail("En TFT, la place va de 1 à 8 dans chaque lobby.");
  const scale = await lobbyScale(ev.game as "tft" | "wz" | "apex");
  const round = await db.eventRound.upsert({
    where: { eventId_n: { eventId: ev.id, n: input.round } },
    create: { eventId: ev.id, n: input.round, lobbies: [], status: input.publish ? "PUBLISHED" : "ENTRY" },
    update: { status: input.publish ? "PUBLISHED" : "ENTRY" },
  });
  await db.$transaction([
    db.eventResult.deleteMany({ where: { roundId: round.id } }),
    db.eventResult.createMany({ data: rows.map((r) => ({ roundId: round.id, entryId: r.entryId, placement: r.placement, kills: r.kills, points: lobbyPoints(scale, r.placement, r.kills), source: "MANUAL" as const })) }),
    db.monthlyEvent.update({ where: { id: ev.id }, data: { status: "LIVE" } }),
    db.auditLog.create({ data: { actorId: v.id, action: input.publish ? "event.round.publish" : "event.round.save", target: `event:${ev.id}:${input.round}`, after: { rows: rows.length } } }),
  ]);
  revalidatePath("/rdv");
  revalidatePath("/admin");
  revalidatePath("/classement");
  return { ok: true, message: `Manche ${input.round} ${input.publish ? "publiée" : "enregistrée (brouillon)"} · ${rows.length} résultat(s).` };
}

/** Clôture : le classement du mois devient définitif et compte au classement général (pas de pré-saison pour les RDV). */
export async function closeEventAction(eventId: string): Promise<EventResult> {
  const v = await getViewer();
  if (!v || v.role !== "admin") return fail("Réservé aux administrateurs.");
  const ev = await db.monthlyEvent.findUnique({ where: { id: eventId }, include: { rounds: true } });
  if (!ev) return fail("Rendez-vous introuvable.");
  if (ev.rounds.filter((r) => r.status === "PUBLISHED").length < 1) return fail("Publiez au moins une manche avant de clôturer.");
  await db.monthlyEvent.update({ where: { id: ev.id }, data: { status: "DONE" } });
  await db.auditLog.create({ data: { actorId: v.id, action: "event.close", target: `event:${ev.id}` } });
  revalidatePath("/rdv");
  revalidatePath("/admin");
  revalidatePath("/classement");
  return { ok: true, message: "Rendez-vous clôturé : résultats définitifs." };
}
