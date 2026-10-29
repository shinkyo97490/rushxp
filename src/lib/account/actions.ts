"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { getViewer } from "@/lib/auth/viewer";
import { db } from "@/lib/db";
import { GAMES } from "@/lib/data/games";
import { DAYS, GAME_LINK, REGIONS, pseudoSchema, toFieldErrors, type FieldErrors } from "@/lib/validation";
import { NOTIF_CATEGORIES, PRIVACY_OPTIONS } from "./preferences";

export type AccountResult = { ok: true; message?: string } | { ok: false; errors: FieldErrors };
const fail = (msg: string, field = "_"): AccountResult => ({ ok: false, errors: { [field]: msg } });
const GAME_IDS = GAMES.map((g) => g.id) as [string, ...string[]];

async function me() {
  return getViewer();
}

// ─── Profil ──────────────────────────────────────────────────────

export async function updateProfileAction(input: unknown): Promise<AccountResult> {
  const v = await me();
  if (!v) return fail("Session expirée.");
  const p = z
    .object({ pseudo: pseudoSchema, bio: z.string().trim().max(300, "300 caractères maximum."), region: z.enum(REGIONS), availability: z.array(z.enum(DAYS)) })
    .safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  const taken = await db.user.findFirst({ where: { pseudo: { equals: p.data.pseudo, mode: "insensitive" }, NOT: { id: v.id } }, select: { id: true } });
  if (taken) return fail("Ce pseudo est déjà pris.", "pseudo");
  await db.user.update({ where: { id: v.id }, data: { ...p.data, bio: p.data.bio || null } });
  revalidatePath("/", "layout");
  return { ok: true, message: "✓ Modifications enregistrées" };
}

// ─── Sécurité ────────────────────────────────────────────────────

export async function changePasswordAction(input: { current: string; next: string; confirm: string }): Promise<AccountResult> {
  const p = z
    .object({ current: z.string().min(1, "Saisissez votre mot de passe actuel."), next: z.string().min(8, "8 caractères minimum.").max(128), confirm: z.string() })
    .refine((x) => x.next === x.confirm, { path: ["confirm"], message: "Les deux mots de passe ne correspondent pas." })
    .safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  try {
    await auth.api.changePassword({ body: { currentPassword: p.data.current, newPassword: p.data.next, revokeOtherSessions: true }, headers: await headers() });
  } catch {
    return fail("Mot de passe actuel incorrect.", "current");
  }
  revalidatePath("/parametres");
  return { ok: true, message: "✓ Mot de passe modifié. Vos autres sessions ont été déconnectées." };
}

export async function revokeSessionAction(token: string): Promise<AccountResult> {
  try {
    await auth.api.revokeSession({ body: { token }, headers: await headers() });
  } catch {
    return fail("Impossible de fermer cette session.");
  }
  revalidatePath("/parametres");
  return { ok: true, message: "Session déconnectée." };
}

// ─── Comptes de jeu ──────────────────────────────────────────────

export async function linkGameAction(input: { game: string; externalId: string }): Promise<AccountResult> {
  const v = await me();
  if (!v) return fail("Session expirée.");
  const p = z.object({ game: z.enum(GAME_IDS), externalId: z.string().trim() }).safeParse(input);
  if (!p.success) return fail("Données invalides.");
  const meta = GAME_LINK[p.data.game];
  if (!meta.pattern.test(p.data.externalId)) return fail(`${meta.label} invalide. ${meta.hint}.`, p.data.game);
  const taken = await db.gameAccount.findFirst({ where: { game: p.data.game, externalId: p.data.externalId, NOT: { userId: v.id } } });
  if (taken) return fail("Cet identifiant est déjà lié à un autre compte RushXP.", p.data.game);
  await db.gameAccount.upsert({
    where: { userId_game: { userId: v.id, game: p.data.game } },
    create: { userId: v.id, game: p.data.game, provider: meta.provider, externalId: p.data.externalId },
    update: { externalId: p.data.externalId, verifiedAt: null },
  });
  revalidatePath("/parametres");
  return { ok: true, message: "Identifiant enregistré (non vérifié)." };
}

export async function unlinkGameAction(game: string): Promise<AccountResult> {
  const v = await me();
  if (!v) return fail("Session expirée.");
  await db.gameAccount.deleteMany({ where: { userId: v.id, game } });
  revalidatePath("/parametres");
  return { ok: true, message: "Compte délié." };
}

// ─── Confidentialité ─────────────────────────────────────────────

export async function updatePrivacyAction(input: Record<string, string>): Promise<AccountResult> {
  const v = await me();
  if (!v) return fail("Session expirée.");
  const clean: Record<string, string> = {};
  for (const o of PRIVACY_OPTIONS) if ((o.opts as readonly string[]).includes(input[o.key])) clean[o.key] = input[o.key];
  await db.user.update({ where: { id: v.id }, data: { privacy: clean } });
  revalidatePath("/parametres");
  return { ok: true, message: "✓ Préférences enregistrées" };
}

/** Anonymise le compte : les résultats validés restent dans l'historique sous « Joueur supprimé ». */
export async function deleteAccountAction(password: string): Promise<AccountResult> {
  const v = await me();
  if (!v) return fail("Session expirée.");
  if (v.structure) return fail("Vous gérez une structure : confiez-la à un autre gestionnaire (ou contactez RushXP) avant de supprimer votre compte.");
  try {
    await auth.api.verifyPassword({ body: { password }, headers: await headers() });
  } catch {
    return fail("Mot de passe incorrect.", "password");
  }
  const now = new Date();
  const anon = `supprime-${v.id.slice(-8)}`;
  await db.$transaction([
    db.gameAccount.deleteMany({ where: { userId: v.id } }),
    db.structureMember.updateMany({ where: { userId: v.id, leftAt: null }, data: { leftAt: now } }),
    db.rosterMember.updateMany({ where: { userId: v.id, leftAt: null }, data: { leftAt: now } }),
    db.roster.updateMany({ where: { captainId: v.id }, data: { captainId: null } }),
    db.invitation.updateMany({ where: { userId: v.id, status: "PENDING" }, data: { status: "CANCELLED" } }),
    db.recruitAd.deleteMany({ where: { authorId: v.id } }),
    db.notification.deleteMany({ where: { userId: v.id } }),
    db.session.deleteMany({ where: { userId: v.id } }),
    db.account.deleteMany({ where: { userId: v.id } }),
    db.user.update({ where: { id: v.id }, data: { pseudo: anon, email: `${anon}@supprime.invalid`, bio: null, image: null, availability: [], privacy: {}, notifPrefs: {} } }),
    db.auditLog.create({ data: { actorId: v.id, action: "user.delete", target: `user:${v.id}` } }),
  ]);
  redirect("/");
}

// ─── Notifications ───────────────────────────────────────────────

export async function markAllReadAction(): Promise<AccountResult> {
  const v = await me();
  if (!v) return fail("Session expirée.");
  await db.notification.updateMany({ where: { userId: v.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markReadAction(id: string): Promise<AccountResult> {
  const v = await me();
  if (!v) return fail("Session expirée.");
  await db.notification.updateMany({ where: { id, userId: v.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateNotifPrefsAction(prefs: Record<string, { site: boolean; email: boolean }>): Promise<AccountResult> {
  const v = await me();
  if (!v) return fail("Session expirée.");
  const clean: Record<string, { site: boolean; email: boolean }> = {};
  for (const c of NOTIF_CATEGORIES) {
    const x = prefs[c.key];
    if (x) clean[c.key] = { site: c.locked ? true : !!x.site, email: !!x.email };
  }
  await db.user.update({ where: { id: v.id }, data: { notifPrefs: clean } });
  revalidatePath("/notifications");
  return { ok: true, message: "✓ Préférences enregistrées" };
}
