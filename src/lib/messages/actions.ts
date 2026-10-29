"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getViewer, type Viewer } from "@/lib/auth/viewer";
import { resolvePrivacy } from "@/lib/account/preferences";

export type MsgResult = { ok: true; message?: string } | { ok: false; errors: Record<string, string> };
const fail = (msg: string): MsgResult => ({ ok: false, errors: { _: msg } });

function pair(a: string, b: string) {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

/** Le destinataire accepte-t-il les messages de cet expéditeur ? (Paramètres · Confidentialité) */
async function dmAllowed(sender: Viewer, recipientId: string): Promise<string | null> {
  const r = await db.user.findUnique({
    where: { id: recipientId },
    select: { privacy: true, status: true, contracts: { where: { leftAt: null }, select: { structureId: true } }, structureStaff: { select: { structureId: true } } },
  });
  if (!r || r.status === "SUSPENDED") return "Ce membre ne peut pas recevoir de messages.";
  const dm = resolvePrivacy(r.privacy).dm;
  if (dm === "Personne") return "Ce membre n’accepte pas les messages privés.";
  if (dm === "Structures et coéquipiers") {
    const theirClubs = new Set([...r.contracts, ...r.structureStaff].map((x) => x.structureId));
    const ok = !!sender.structure || (!!sender.club && theirClubs.has(sender.club.id));
    if (!ok) return "Ce membre n’accepte que les messages des structures et de ses coéquipiers.";
  }
  return null;
}

/** Ouvre (ou crée) la conversation avec un membre, puis redirige vers elle. */
export async function openThreadAction(pseudo: string) {
  const v = await getViewer();
  if (!v) redirect("/connexion?next=/messages");
  const other = await db.user.findFirst({ where: { pseudo: { equals: pseudo, mode: "insensitive" } }, select: { id: true } });
  if (!other || other.id === v.id) redirect("/messages");
  const existing = await db.thread.findUnique({ where: { userAId_userBId: pair(v.id, other.id) } });
  if (existing) redirect(`/messages?t=${existing.id}`);
  const block = await dmAllowed(v, other.id);
  if (block) redirect(`/messages?erreur=${encodeURIComponent(block)}`);
  const t = await db.thread.create({ data: pair(v.id, other.id) });
  redirect(`/messages?t=${t.id}`);
}

export async function sendMessageAction(input: { threadId: string; text: string }): Promise<MsgResult> {
  const v = await getViewer();
  if (!v) return fail("Session expirée.");
  const text = input.text.trim();
  if (!text) return fail("Message vide.");
  if (text.length > 2000) return fail("2 000 caractères maximum.");
  const t = await db.thread.findUnique({ where: { id: input.threadId } });
  if (!t || (t.userAId !== v.id && t.userBId !== v.id)) return fail("Conversation introuvable.");
  const otherId = t.userAId === v.id ? t.userBId : t.userAId;
  const block = await dmAllowed(v, otherId);
  if (block) return fail(block);
  // Anti-spam simple : 20 messages par minute.
  const recent = await db.message.count({ where: { authorId: v.id, createdAt: { gt: new Date(Date.now() - 60_000) } } });
  if (recent >= 20) return fail("Trop de messages envoyés. Patientez une minute.");
  const now = new Date();
  await db.$transaction([
    db.message.create({ data: { threadId: t.id, authorId: v.id, text } }),
    db.thread.update({ where: { id: t.id }, data: { lastAt: now, ...(t.userAId === v.id ? { readA: now } : { readB: now }) } }),
  ]);
  revalidatePath("/messages");
  return { ok: true };
}

export async function markThreadReadAction(threadId: string): Promise<MsgResult> {
  const v = await getViewer();
  if (!v) return fail("Session expirée.");
  const t = await db.thread.findUnique({ where: { id: threadId } });
  if (!t || (t.userAId !== v.id && t.userBId !== v.id)) return fail("Conversation introuvable.");
  await db.thread.update({ where: { id: t.id }, data: t.userAId === v.id ? { readA: new Date() } : { readB: new Date() } });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reportMessageAction(messageId: string): Promise<MsgResult> {
  const v = await getViewer();
  if (!v) return fail("Session expirée.");
  const m = await db.message.findUnique({ where: { id: messageId }, include: { thread: true } });
  if (!m || m.authorId === v.id || (m.thread.userAId !== v.id && m.thread.userBId !== v.id)) return fail("Signalement impossible.");
  await db.message.update({ where: { id: m.id }, data: { reported: true } });
  await db.auditLog.create({ data: { actorId: v.id, action: "message.report", target: `message:${m.id}` } });
  return { ok: true, message: "Message signalé à l’équipe d’arbitrage." };
}
