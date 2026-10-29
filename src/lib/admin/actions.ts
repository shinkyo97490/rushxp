"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getViewer, type Viewer } from "@/lib/auth/viewer";
import { toFieldErrors, type FieldErrors } from "@/lib/validation";

export type AdminResult = { ok: true; message?: string } | { ok: false; errors: FieldErrors };
const fail = (msg: string, field = "_"): AdminResult => ({ ok: false, errors: { [field]: msg } });

/** Contrôle serveur : admin seulement, ou admin + arbitre. */
async function requireStaff(adminOnly: boolean): Promise<Viewer | null> {
  const v = await getViewer();
  if (!v) return null;
  if (v.role === "admin") return v;
  if (!adminOnly && v.role === "arbitre") return v;
  return null;
}

async function audit(actorId: string, action: string, target: string, before?: object, after?: object) {
  await db.auditLog.create({ data: { actorId, action, target, before, after } });
}

function done(message: string): AdminResult {
  revalidatePath("/admin");
  return { ok: true, message };
}

// ─── Structures ──────────────────────────────────────────────────

export async function reviewStructureAction(input: { id: string; approve: boolean; reason?: string }): Promise<AdminResult> {
  const v = await requireStaff(true);
  if (!v) return fail("Réservé aux administrateurs.");
  const s = await db.structure.findUnique({ where: { id: input.id }, include: { staff: { select: { userId: true } } } });
  if (!s) return fail("Structure introuvable.");
  if (!input.approve && !input.reason?.trim()) return fail("Indiquez le motif du refus.", "reason");
  const status = input.approve ? "VERIFIED" : "DRAFT";
  await db.$transaction([
    db.structure.update({ where: { id: s.id }, data: { status, verifiedAt: input.approve ? new Date() : null } }),
    db.notification.createMany({
      data: s.staff.map((m) => ({
        userId: m.userId,
        category: "equipe",
        text: input.approve ? `${s.name} est vérifiée : votre page est publique.` : `${s.name} n’a pas été validée : ${input.reason}`,
        link: input.approve ? `/structure/${s.tag}` : "/recrutement",
      })),
    }),
  ]);
  await audit(v.id, input.approve ? "structure.verify" : "structure.reject", `structure:${s.id}`, { status: s.status }, { status, reason: input.reason });
  return done(input.approve ? `${s.name} vérifiée.` : `${s.name} renvoyée en brouillon.`);
}

// ─── Utilisateurs ────────────────────────────────────────────────

export async function setUserRoleAction(input: { userId: string; role: "JOUEUR" | "ARBITRE" | "ADMIN" }): Promise<AdminResult> {
  const v = await requireStaff(true);
  if (!v) return fail("Réservé aux administrateurs.");
  if (input.userId === v.id && input.role !== "ADMIN") return fail("Vous ne pouvez pas retirer votre propre rôle d’administrateur.");
  const p = z.enum(["JOUEUR", "ARBITRE", "ADMIN"]).safeParse(input.role);
  if (!p.success) return fail("Rôle invalide.");
  const u = await db.user.findUnique({ where: { id: input.userId }, select: { role: true, pseudo: true } });
  if (!u) return fail("Utilisateur introuvable.");
  await db.user.update({ where: { id: input.userId }, data: { role: p.data } });
  await audit(v.id, "user.role", `user:${input.userId}`, { role: u.role }, { role: p.data });
  return done(`Rôle de ${u.pseudo} mis à jour.`);
}

export async function setUserStatusAction(input: { userId: string; suspend: boolean; reason?: string }): Promise<AdminResult> {
  const v = await requireStaff(true);
  if (!v) return fail("Réservé aux administrateurs.");
  if (input.userId === v.id) return fail("Vous ne pouvez pas suspendre votre propre compte.");
  if (input.suspend && !input.reason?.trim()) return fail("Indiquez le motif de la suspension.", "reason");
  const u = await db.user.findUnique({ where: { id: input.userId }, select: { status: true, pseudo: true } });
  if (!u) return fail("Utilisateur introuvable.");
  await db.$transaction([
    db.user.update({ where: { id: input.userId }, data: { status: input.suspend ? "SUSPENDED" : "ACTIVE" } }),
    // Suspension : toutes les sessions sont fermées immédiatement.
    ...(input.suspend ? [db.session.deleteMany({ where: { userId: input.userId } })] : []),
  ]);
  await audit(v.id, input.suspend ? "user.suspend" : "user.reactivate", `user:${input.userId}`, { status: u.status }, { reason: input.reason });
  return done(input.suspend ? `${u.pseudo} suspendu.` : `${u.pseudo} réactivé.`);
}

// ─── Annonces ────────────────────────────────────────────────────

export async function moderateAdAction(input: { id: string; approve: boolean }): Promise<AdminResult> {
  const v = await requireStaff(true);
  if (!v) return fail("Réservé aux administrateurs.");
  const ad = await db.recruitAd.findUnique({ where: { id: input.id } });
  if (!ad) return fail("Annonce introuvable.");
  await db.$transaction([
    db.recruitAd.update({ where: { id: ad.id }, data: { moderation: input.approve ? "APPROVED" : "REJECTED" } }),
    db.notification.create({
      data: { userId: ad.authorId, category: "recrutement", text: input.approve ? "Votre annonce de recrutement est publiée." : "Votre annonce de recrutement a été refusée par la modération.", link: "/recrutement?tab=annonces" },
    }),
  ]);
  await audit(v.id, input.approve ? "ad.approve" : "ad.reject", `ad:${ad.id}`);
  return done(input.approve ? "Annonce publiée." : "Annonce refusée.");
}

// ─── Sanctions ───────────────────────────────────────────────────

const SANCTION_TYPES = ["Avertissement", "Carton jaune", "Carton rouge", "Suspension 1 match", "Suspension 3 matchs", "Pénalité −20 pts"] as const;

export async function createSanctionAction(input: unknown): Promise<AdminResult> {
  const v = await requireStaff(false);
  if (!v) return fail("Réservé aux arbitres et administrateurs.");
  const p = z
    .object({
      target: z.string().trim().min(1, "Indiquez un pseudo ou un tag de structure."),
      type: z.enum(SANCTION_TYPES),
      reason: z.string().trim().min(5, "Précisez le motif (article du règlement)."),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  const user = await db.user.findFirst({ where: { pseudo: { equals: p.data.target, mode: "insensitive" } }, select: { id: true, pseudo: true } });
  const structure = user ? null : await db.structure.findFirst({ where: { OR: [{ tag: { equals: p.data.target, mode: "insensitive" } }, { name: { equals: p.data.target, mode: "insensitive" } }] }, include: { staff: true } });
  if (!user && !structure) return fail("Aucun joueur ni structure ne correspond.", "target");
  const days = p.data.type === "Suspension 3 matchs" ? 21 : p.data.type === "Suspension 1 match" || p.data.type === "Carton rouge" ? 7 : null;
  const until = days ? new Date(Date.now() + days * 86_400_000) : null;
  const s = await db.sanction.create({
    data: { targetType: user ? "USER" : "STRUCTURE", targetId: user?.id ?? structure!.id, type: p.data.type, reason: p.data.reason, article: p.data.reason.match(/Art\.\s*[\d.]+/i)?.[0] ?? null, until, createdById: v.id },
  });
  const notify = user ? [user.id] : structure!.staff.map((x) => x.userId);
  await db.notification.createMany({ data: notify.map((userId) => ({ userId, category: "systeme", text: `Sanction : ${p.data.type} · ${p.data.reason}. Appel possible sous 48 h.`, link: "/reglement" })) });
  await audit(v.id, "sanction.create", `sanction:${s.id}`, undefined, { target: user?.pseudo ?? structure!.name, type: p.data.type });
  return done("Sanction appliquée et notifiée.");
}

export async function liftSanctionAction(id: string): Promise<AdminResult> {
  const v = await requireStaff(false);
  if (!v) return fail("Réservé aux arbitres et administrateurs.");
  await db.sanction.update({ where: { id }, data: { liftedAt: new Date() } });
  await audit(v.id, "sanction.lift", `sanction:${id}`);
  return done("Sanction levée.");
}

// ─── Formats et barèmes ──────────────────────────────────────────

export async function updateGameFormatAction(input: unknown): Promise<AdminResult> {
  const v = await requireStaff(true);
  if (!v) return fail("Réservé aux administrateurs.");
  const p = z
    .object({
      id: z.string(),
      rosterSize: z.coerce.number().int().min(1, "1 minimum.").max(10, "10 maximum."),
      series: z.string().trim().max(10),
      lobbySize: z.union([z.literal(""), z.coerce.number().int().min(2).max(100)]),
      scale: z.string().trim().regex(/^(\d+\s*(,\s*\d+\s*)*)?$/, "Nombres séparés par des virgules."),
      killPoint: z.coerce.number().int().min(0).max(10),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  const before = await db.game.findUnique({ where: { id: p.data.id } });
  if (!before) return fail("Jeu introuvable.");
  const scale = p.data.scale ? p.data.scale.split(",").map((x) => Number(x.trim())) : null;
  const after = await db.game.update({
    where: { id: p.data.id },
    data: { rosterSize: p.data.rosterSize, series: p.data.series || null, lobbySize: p.data.lobbySize === "" ? null : p.data.lobbySize, scale: scale ?? undefined, killPoint: p.data.killPoint },
  });
  await audit(v.id, "game.format", `game:${p.data.id}`, before, after);
  return done(`Format de ${after.name} enregistré.`);
}

// ─── Diffusion ───────────────────────────────────────────────────

export async function broadcastAction(input: { text: string; link?: string }): Promise<AdminResult> {
  const v = await requireStaff(true);
  if (!v) return fail("Réservé aux administrateurs.");
  const p = z.object({ text: z.string().trim().min(10, "10 caractères minimum.").max(200, "200 caractères maximum."), link: z.string().trim().regex(/^(\/[^\s]*)?$/, "Lien interne commençant par /.").optional() }).safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  const users = await db.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  await db.notification.createMany({ data: users.map((u) => ({ userId: u.id, category: "communaute", text: p.data.text, link: p.data.link || null })) });
  await audit(v.id, "notification.broadcast", "users:*", undefined, { text: p.data.text, count: users.length });
  return done(`Annonce envoyée à ${users.length} membre(s).`);
}

// ─── Signalements (arbitre) ──────────────────────────────────────

export async function resolveReportAction(input: { messageId: string; decision: "mask" | "dismiss" }): Promise<AdminResult> {
  const v = await requireStaff(false);
  if (!v) return fail("Réservé aux arbitres et administrateurs.");
  const m = await db.message.findUnique({ where: { id: input.messageId } });
  if (!m) return fail("Message introuvable.");
  await db.message.update({ where: { id: m.id }, data: { reported: false, ...(input.decision === "mask" ? { text: "[message masqué par la modération]" } : {}) } });
  await audit(v.id, input.decision === "mask" ? "message.mask" : "report.dismiss", `message:${m.id}`, input.decision === "mask" ? { text: m.text } : undefined);
  revalidatePath("/arbitrage");
  return { ok: true, message: input.decision === "mask" ? "Message masqué." : "Signalement classé sans suite." };
}
