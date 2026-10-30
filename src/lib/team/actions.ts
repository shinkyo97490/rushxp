"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getViewer, type Viewer } from "@/lib/auth/viewer";
import { rosterSlotError, transferKind } from "@/lib/rules/roster";
import { GAMES } from "@/lib/data/games";
import { pseudoSchema, toFieldErrors, type FieldErrors } from "@/lib/validation";

export type TeamResult = { ok: true; message?: string } | { ok: false; errors: FieldErrors };

const fail = (msg: string, field = "_"): TeamResult => ({ ok: false, errors: { [field]: msg } });
const GAME_IDS = GAMES.map((g) => g.id) as [string, ...string[]];

async function viewer(): Promise<Viewer | null> {
  return getViewer();
}

async function isStaffOf(userId: string, structureId: string) {
  return !!(await db.structureStaff.findUnique({ where: { structureId_userId: { structureId, userId } } }));
}

async function canManageRoster(userId: string, rosterId: string) {
  const r = await db.roster.findUnique({ where: { id: rosterId }, select: { structureId: true, captainId: true } });
  if (!r) return null;
  return r.captainId === userId || (await isStaffOf(userId, r.structureId)) ? r : null;
}

async function rosterCounts(rosterId: string) {
  const r = await db.roster.findUniqueOrThrow({
    where: { id: rosterId },
    include: { gameRef: { select: { rosterSize: true } }, members: { where: { leftAt: null }, select: { role: true } } },
  });
  return {
    roster: r,
    counts: {
      rosterSize: r.gameRef.rosterSize,
      starters: r.members.filter((m) => m.role === "STARTER").length,
      subs: r.members.filter((m) => m.role === "SUB").length,
    },
  };
}

async function activeContract(userId: string) {
  return db.structureMember.findFirst({ where: { userId, leftAt: null } });
}

/**
 * Départ d'une structure (transfert ou libération) : fin du contrat, sortie des rosters
 * de cette structure, perte du capitanat, notification des gestionnaires.
 */
async function leaveStructure(userId: string, structureId: string, notice: string) {
  const now = new Date();
  const [rosters, staff] = await Promise.all([
    db.roster.findMany({ where: { structureId }, select: { id: true } }),
    db.structureStaff.findMany({ where: { structureId }, select: { userId: true } }),
  ]);
  await db.$transaction([
    db.structureMember.updateMany({ where: { structureId, userId, leftAt: null }, data: { leftAt: now } }),
    db.rosterMember.updateMany({ where: { userId, leftAt: null, rosterId: { in: rosters.map((r) => r.id) } }, data: { leftAt: now } }),
    db.roster.updateMany({ where: { structureId, captainId: userId }, data: { captainId: null } }),
    db.notification.createMany({ data: staff.map((m) => ({ userId: m.userId, category: "recrutement", text: notice, link: "/recrutement?tab=transferts" })) }),
  ]);
}

/** Ajoute un joueur sous contrat à un roster en vérifiant : une équipe par jeu, places disponibles. */
async function addToRoster(userId: string, rosterId: string, role: "STARTER" | "SUB"): Promise<string | null> {
  const { roster, counts } = await rosterCounts(rosterId);
  const already = await db.rosterMember.findFirst({ where: { userId, game: roster.game, leftAt: null }, include: { roster: { select: { name: true } } } });
  if (already) return already.rosterId === rosterId ? "Ce joueur est déjà dans ce roster." : `Un joueur n’est que dans une seule équipe par jeu (déjà dans « ${already.roster.name} »).`;
  const slot = rosterSlotError(counts, role);
  if (slot) return slot;
  await db.rosterMember.create({ data: { rosterId, userId, game: roster.game, role } });
  return null;
}

function done(message?: string): TeamResult {
  revalidatePath("/recrutement");
  return { ok: true, message };
}

// ─── Équipes ─────────────────────────────────────────────────────

export async function addTeamAction(input: { structureId: string; game: string; name: string }): Promise<TeamResult> {
  const v = await viewer();
  if (!v) return fail("Session expirée.");
  const p = z.object({ structureId: z.string(), game: z.enum(GAME_IDS), name: z.string().trim().min(3, "3 caractères minimum.").max(40, "40 caractères maximum.") }).safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  if (!(await isStaffOf(v.id, p.data.structureId))) return fail("Seul un gestionnaire peut ajouter une équipe.");
  const exists = await db.roster.findFirst({ where: { structureId: p.data.structureId, game: p.data.game, name: { equals: p.data.name, mode: "insensitive" } } });
  if (exists) return fail("Une équipe porte déjà ce nom sur ce jeu.", "name");
  await db.roster.create({ data: { structureId: p.data.structureId, game: p.data.game, name: p.data.name } });
  return done("Équipe créée.");
}

// ─── Invitations et demandes ─────────────────────────────────────

export async function invitePlayerAction(input: { rosterId: string; pseudo: string; role: "STARTER" | "SUB" }): Promise<TeamResult> {
  const v = await viewer();
  if (!v) return fail("Session expirée.");
  const p = z.object({ rosterId: z.string(), pseudo: pseudoSchema, role: z.enum(["STARTER", "SUB"]) }).safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  const r = await canManageRoster(v.id, p.data.rosterId);
  if (!r) return fail("Seul le capitaine ou un gestionnaire peut inviter dans ce roster.");
  const target = await db.user.findFirst({ where: { pseudo: { equals: p.data.pseudo, mode: "insensitive" } }, select: { id: true, pseudo: true } });
  if (!target) return fail("Aucun joueur avec ce pseudo.", "pseudo");
  const contract = await activeContract(target.id);
  if (contract?.structureId === r.structureId) {
    // Déjà dans l'effectif : ajout direct au roster.
    const err = await addToRoster(target.id, p.data.rosterId, p.data.role);
    return err ? fail(err, "pseudo") : done(`${target.pseudo} ajouté au roster.`);
  }
  const structure = await db.structure.findUniqueOrThrow({ where: { id: r.structureId }, select: { name: true } });
  await db.$transaction([
    db.invitation.upsert({
      where: { structureId_userId: { structureId: r.structureId, userId: target.id } },
      create: { structureId: r.structureId, userId: target.id, invitedById: v.id, kind: "INVITE", rosterId: p.data.rosterId, memberRole: p.data.role },
      update: { status: "PENDING", kind: "INVITE", invitedById: v.id, rosterId: p.data.rosterId, memberRole: p.data.role },
    }),
    db.notification.create({ data: { userId: target.id, category: "recrutement", text: `${v.pseudo} vous invite à rejoindre ${structure.name}.`, link: "/recrutement" } }),
  ]);
  return done(`Invitation envoyée à ${target.pseudo}.`);
}

export async function respondInvitationAction(input: { id: string; accept: boolean }): Promise<TeamResult> {
  const v = await viewer();
  if (!v) return fail("Session expirée.");
  const inv = await db.invitation.findUnique({ where: { id: input.id }, include: { structure: { select: { name: true, staff: { select: { userId: true } } } }, user: { select: { pseudo: true } } } });
  if (!inv || inv.status !== "PENDING") return fail("Cette invitation n’est plus valable.");
  // INVITE : c'est le joueur qui répond. REQUEST : c'est un gestionnaire de la structure.
  const allowed = inv.kind === "INVITE" ? inv.userId === v.id : inv.structure.staff.some((s) => s.userId === v.id);
  if (!allowed) return fail("Vous ne pouvez pas répondre à cette invitation.");

  if (!input.accept) {
    await db.invitation.update({ where: { id: inv.id }, data: { status: "DECLINED" } });
    const notify = inv.kind === "INVITE" ? inv.structure.staff.map((s) => s.userId) : [inv.userId];
    await db.notification.createMany({ data: notify.map((userId) => ({ userId, category: "recrutement", text: inv.kind === "INVITE" ? `${inv.user.pseudo} a décliné l’invitation de ${inv.structure.name}.` : `Votre demande pour ${inv.structure.name} a été refusée.`, link: "/recrutement" })) });
    return done("Réponse enregistrée.");
  }

  const contract = await activeContract(inv.userId);
  const kind = transferKind(contract?.structureId ?? null, inv.structureId);
  if (kind === "TRANSFER") await leaveStructure(inv.userId, contract!.structureId, `${inv.user.pseudo} a rejoint ${inv.structure.name}.`);
  if (kind !== "SAME") {
    await db.$transaction([
      db.structureMember.create({ data: { structureId: inv.structureId, userId: inv.userId } }),
      db.transfer.create({
        data: { userId: inv.userId, fromStructureId: contract?.structureId ?? null, toStructureId: inv.structureId, game: "*", kind, status: "APPROVED", window: "libre" },
      }),
    ]);
  }
  let note: string | undefined;
  if (inv.rosterId) {
    const err = await addToRoster(inv.userId, inv.rosterId, inv.memberRole);
    if (err) note = `Signature effectuée, mais ajout au roster impossible : ${err}`;
  }
  await db.invitation.update({ where: { id: inv.id }, data: { status: "ACCEPTED" } });
  const notify = inv.kind === "INVITE" ? inv.structure.staff.map((s) => s.userId) : [inv.userId];
  await db.notification.createMany({ data: notify.map((userId) => ({ userId, category: "recrutement", text: inv.kind === "INVITE" ? `${inv.user.pseudo} a rejoint ${inv.structure.name}.` : `Bienvenue chez ${inv.structure.name} : votre demande est acceptée.`, link: "/recrutement" })) });
  await db.auditLog.create({ data: { actorId: v.id, action: "structure.join", target: `structure:${inv.structureId}`, after: { userId: inv.userId, via: inv.kind } } });
  return done(note ?? "Bienvenue dans la structure.");
}

export async function cancelInvitationAction(id: string): Promise<TeamResult> {
  const v = await viewer();
  if (!v) return fail("Session expirée.");
  const inv = await db.invitation.findUnique({ where: { id } });
  if (!inv || inv.status !== "PENDING") return fail("Cette invitation n’est plus valable.");
  const allowed = inv.kind === "REQUEST" ? inv.userId === v.id : await isStaffOf(v.id, inv.structureId);
  if (!allowed) return fail("Action non autorisée.");
  await db.invitation.update({ where: { id }, data: { status: "CANCELLED" } });
  return done("Annulée.");
}

// ─── Gestion des rosters (gestionnaire) ──────────────────────────

async function staffForRoster(userId: string, rosterId: string) {
  const r = await db.roster.findUnique({ where: { id: rosterId }, select: { structureId: true, captainId: true } });
  return r && (await isStaffOf(userId, r.structureId)) ? r : null;
}

export async function assignMemberAction(input: { rosterId: string; userId: string; role: "STARTER" | "SUB" }): Promise<TeamResult> {
  const v = await viewer();
  if (!v) return fail("Session expirée.");
  const r = await staffForRoster(v.id, input.rosterId);
  if (!r) return fail("Seul un gestionnaire peut composer les rosters.");
  const contract = await activeContract(input.userId);
  if (contract?.structureId !== r.structureId) return fail("Ce joueur n’est pas sous contrat avec la structure.");
  const err = await addToRoster(input.userId, input.rosterId, input.role);
  return err ? fail(err) : done("Joueur ajouté au roster.");
}

export async function removeFromRosterAction(input: { rosterId: string; userId: string }): Promise<TeamResult> {
  const v = await viewer();
  if (!v) return fail("Session expirée.");
  const r = await staffForRoster(v.id, input.rosterId);
  if (!r) return fail("Seul un gestionnaire peut retirer un joueur.");
  await db.$transaction([
    db.rosterMember.updateMany({ where: { rosterId: input.rosterId, userId: input.userId, leftAt: null }, data: { leftAt: new Date() } }),
    ...(r.captainId === input.userId ? [db.roster.update({ where: { id: input.rosterId }, data: { captainId: null } })] : []),
  ]);
  return done("Joueur retiré du roster.");
}

export async function toggleMemberRoleAction(input: { rosterId: string; userId: string }): Promise<TeamResult> {
  const v = await viewer();
  if (!v) return fail("Session expirée.");
  if (!(await staffForRoster(v.id, input.rosterId))) return fail("Action réservée aux gestionnaires.");
  const m = await db.rosterMember.findFirst({ where: { rosterId: input.rosterId, userId: input.userId, leftAt: null } });
  if (!m) return fail("Joueur introuvable dans ce roster.");
  const next = m.role === "STARTER" ? "SUB" : "STARTER";
  const { counts } = await rosterCounts(input.rosterId);
  const err = rosterSlotError(counts, next);
  if (err) return fail(err);
  await db.rosterMember.update({ where: { rosterId_userId_joinedAt: { rosterId: m.rosterId, userId: m.userId, joinedAt: m.joinedAt } }, data: { role: next } });
  return done();
}

export async function setCaptainAction(input: { rosterId: string; userId: string }): Promise<TeamResult> {
  const v = await viewer();
  if (!v) return fail("Session expirée.");
  if (!(await staffForRoster(v.id, input.rosterId))) return fail("Seul un gestionnaire nomme le capitaine.");
  const m = await db.rosterMember.findFirst({ where: { rosterId: input.rosterId, userId: input.userId, leftAt: null } });
  if (!m) return fail("Le capitaine doit faire partie du roster.");
  await db.roster.update({ where: { id: input.rosterId }, data: { captainId: input.userId } });
  await db.notification.create({ data: { userId: input.userId, category: "equipe", text: "Vous êtes nommé capitaine : vous pouvez lancer les défis et valider les résultats.", link: "/recrutement" } });
  return done("Capitaine nommé.");
}

export async function releasePlayerAction(input: { structureId: string; userId: string }): Promise<TeamResult> {
  const v = await viewer();
  if (!v) return fail("Session expirée.");
  if (!(await isStaffOf(v.id, input.structureId))) return fail("Action réservée aux gestionnaires.");
  const c = await db.structureMember.findFirst({ where: { structureId: input.structureId, userId: input.userId, leftAt: null } });
  if (!c) return fail("Ce joueur n’est pas sous contrat.");
  const now = new Date();
  const rosters = await db.roster.findMany({ where: { structureId: input.structureId }, select: { id: true } });
  await db.$transaction([
    db.structureMember.update({ where: { id: c.id }, data: { leftAt: now } }),
    db.rosterMember.updateMany({ where: { userId: input.userId, leftAt: null, rosterId: { in: rosters.map((r) => r.id) } }, data: { leftAt: now } }),
    db.roster.updateMany({ where: { structureId: input.structureId, captainId: input.userId }, data: { captainId: null } }),
    db.transfer.create({ data: { userId: input.userId, fromStructureId: input.structureId, toStructureId: input.structureId, game: "*", kind: "RELEASE", status: "APPROVED", window: "liberation" } }),
    db.notification.create({ data: { userId: input.userId, category: "recrutement", text: "Vous avez été libéré de votre structure : vous êtes agent libre.", link: "/recrutement" } }),
  ]);
  return done("Joueur libéré : il redevient agent libre.");
}

// ─── Annonces ────────────────────────────────────────────────────

const adSchema = z.object({
  kind: z.enum(["STRUCTURE", "PLAYER"]),
  game: z.enum(GAME_IDS),
  level: z.string().trim().max(40),
  role: z.string().trim().min(2, "Précisez le poste ou le rôle.").max(60),
  availability: z.string().trim().min(2, "Indiquez vos disponibilités.").max(80),
  text: z.string().trim().min(20, "20 caractères minimum.").max(800, "800 caractères maximum."),
});

export async function postAdAction(input: unknown): Promise<TeamResult> {
  const v = await viewer();
  if (!v) return fail("Connectez-vous pour publier une annonce.");
  const p = adSchema.safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  let structureId: string | null = null;
  if (p.data.kind === "STRUCTURE") {
    if (!v.structure) return fail("Seul un gestionnaire de structure publie une annonce de recrutement.");
    structureId = v.structure.id;
  }
  const open = await db.recruitAd.count({ where: { authorId: v.id, expiresAt: { gt: new Date() }, moderation: { not: "REJECTED" } } });
  if (open >= 5) return fail("5 annonces actives maximum.");
  await db.recruitAd.create({
    data: { ...p.data, authorId: v.id, structureId, expiresAt: new Date(Date.now() + 30 * 86_400_000), moderation: "PENDING" },
  });
  return done("Annonce envoyée : elle sera visible après modération.");
}

export async function deleteAdAction(id: string): Promise<TeamResult> {
  const v = await viewer();
  if (!v) return fail("Session expirée.");
  const ad = await db.recruitAd.findUnique({ where: { id } });
  if (!ad || ad.authorId !== v.id) return fail("Action non autorisée.");
  await db.recruitAd.delete({ where: { id } });
  return done("Annonce supprimée.");
}

/** Demande à rejoindre une structure avec son code d'invitation. */
export async function requestJoinAction(code: string): Promise<TeamResult> {
  const v = await viewer();
  if (!v) return fail("Connectez-vous pour rejoindre une structure.");
  const c = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,4}-[A-Z0-9]{4}$/, "Code invalide (ex. NVA-7K2Q).").safeParse(code);
  if (!c.success) return fail(c.error.issues[0].message, "code");
  const s = await db.structure.findUnique({ where: { inviteCode: c.data }, select: { id: true, name: true, staff: { select: { userId: true } } } });
  if (!s) return fail("Aucune structure ne correspond à ce code.", "code");
  const contract = await activeContract(v.id);
  if (contract?.structureId === s.id) return fail("Vous êtes déjà dans cette structure.", "code");
  await db.$transaction([
    db.invitation.upsert({
      where: { structureId_userId: { structureId: s.id, userId: v.id } },
      create: { structureId: s.id, userId: v.id, invitedById: v.id, kind: "REQUEST" },
      update: { status: "PENDING", kind: "REQUEST", invitedById: v.id, rosterId: null },
    }),
    db.notification.createMany({ data: s.staff.map((m) => ({ userId: m.userId, category: "recrutement", text: `${v.pseudo} demande à rejoindre ${s.name}.`, link: "/recrutement" })) }),
  ]);
  return done(`Demande envoyée à ${s.name}.`);
}
