"use server";

import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { structureIdentitySchema, structureSchema, toFieldErrors, type FieldErrors } from "@/lib/validation";

export type StructureResult = { ok: true; inviteCode?: string } | { ok: false; errors: FieldErrors };

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O ni 1/I pour éviter les confusions

function inviteCode(tag: string) {
  return `${tag}-${Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;
}

async function identityConflicts(name: string, tag: string): Promise<FieldErrors> {
  const [byName, byTag] = await Promise.all([
    db.structure.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } }),
    db.structure.findFirst({ where: { tag: { equals: tag, mode: "insensitive" } }, select: { id: true } }),
  ]);
  const e: FieldErrors = {};
  if (byName) e.name = "Ce nom est déjà utilisé par une structure.";
  if (byTag) e.tag = "Ce tag est déjà pris.";
  return e;
}

/** Étape 1 : vérifie la disponibilité du nom et du tag. */
export async function checkIdentityAction(input: unknown): Promise<StructureResult> {
  if (!(await getViewer())) return { ok: false, errors: { _: "Session expirée : reconnectez-vous." } };
  const parsed = structureIdentitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error) };
  const e = await identityConflicts(parsed.data.name, parsed.data.tag);
  return Object.keys(e).length ? { ok: false, errors: e } : { ok: true };
}

/** Étape 3 : les pseudos invités doivent exister. */
export async function checkInvitesAction(pseudos: string[]): Promise<StructureResult> {
  const v = await getViewer();
  if (!v) return { ok: false, errors: { _: "Session expirée : reconnectez-vous." } };
  const unknown = await missingPseudos(pseudos, v.id);
  return unknown.length ? { ok: false, errors: { invites: `Pseudo(s) introuvable(s) : ${unknown.join(", ")}.` } } : { ok: true };
}

async function missingPseudos(pseudos: string[], selfId: string) {
  if (!pseudos.length) return [];
  const found = await db.user.findMany({
    where: { OR: pseudos.map((p) => ({ pseudo: { equals: p, mode: "insensitive" as const } })), NOT: { id: selfId } },
    select: { pseudo: true },
  });
  const ok = new Set(found.map((u) => u.pseudo.toLowerCase()));
  return pseudos.filter((p) => !ok.has(p.toLowerCase()));
}

/** Étape 4 : crée la structure (en attente de vérification RushXP), ses rosters et les invitations. */
export async function createStructureAction(input: unknown): Promise<StructureResult> {
  const v = await getViewer();
  if (!v) return { ok: false, errors: { _: "Session expirée : reconnectez-vous." } };
  if (v.structure) return { ok: false, errors: { _: "Vous gérez déjà une structure." } };
  const parsed = structureSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: toFieldErrors(parsed.error) };
  const d = parsed.data;
  const conflicts = await identityConflicts(d.name, d.tag);
  if (Object.keys(conflicts).length) return { ok: false, errors: conflicts };
  const unknown = await missingPseudos(d.invites, v.id);
  if (unknown.length) return { ok: false, errors: { invites: `Pseudo(s) introuvable(s) : ${unknown.join(", ")}.` } };

  const invitees = d.invites.length
    ? await db.user.findMany({ where: { OR: d.invites.map((p) => ({ pseudo: { equals: p, mode: "insensitive" as const } })) }, select: { id: true } })
    : [];

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = inviteCode(d.tag);
    try {
      await db.$transaction(async (tx) => {
        const s = await tx.structure.create({
          data: {
            name: d.name,
            tag: d.tag,
            region: d.region,
            bio: d.bio || null,
            inviteCode: code,
            status: "PENDING",
            staff: { create: { userId: v.id, role: "OWNER" } },
            rosters: { create: d.games.map((game) => ({ game, name: d.name })) },
            invitations: { create: invitees.map((u) => ({ userId: u.id, invitedById: v.id, kind: "INVITE" as const })) },
          },
        });
        if (invitees.length)
          await tx.notification.createMany({
            data: invitees.map((u) => ({ userId: u.id, category: "recrutement", text: `${v.pseudo} vous invite à rejoindre ${d.name}.`, link: "/recrutement" })),
          });
        await tx.auditLog.create({ data: { actorId: v.id, action: "structure.create", target: `structure:${s.id}`, after: { name: d.name, tag: d.tag, games: d.games } } });
      });
      return { ok: true, inviteCode: code };
    } catch (e) {
      // Collision rare du code d'invitation (ou création concurrente du même nom) : on réessaie, puis on revérifie.
      if ((e as { code?: string }).code !== "P2002") throw e;
      const again = await identityConflicts(d.name, d.tag);
      if (Object.keys(again).length) return { ok: false, errors: again };
    }
  }
  return { ok: false, errors: { _: "Création impossible pour le moment. Réessayez." } };
}
