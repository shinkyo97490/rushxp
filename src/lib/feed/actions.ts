"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { toFieldErrors, type FieldErrors } from "@/lib/validation";
import { POST_IMAGES } from "./images";

export type FeedResult = { ok: true; message?: string; id?: string } | { ok: false; errors: FieldErrors };
const fail = (m: string, f = "_"): FeedResult => ({ ok: false, errors: { [f]: m } });

const postSchema = z
  .object({
    kind: z.enum(["ANNONCE", "RESULTAT", "VIDEO", "GALERIE", "SONDAGE", "STRUCTURE"]),
    title: z.string().trim().min(5, "5 caractères minimum.").max(140, "140 caractères maximum."),
    body: z.string().trim().max(2000, "2 000 caractères maximum.").optional().default(""),
    image: z.string().optional().default(""),
    options: z.array(z.string().trim().min(1).max(60)).max(6).optional().default([]),
    pinned: z.boolean().optional().default(false),
  })
  .refine((p) => p.kind !== "SONDAGE" || p.options.length >= 2, { path: ["options"], message: "Un sondage a au moins 2 options." })
  .refine((p) => !p.image || (POST_IMAGES as readonly string[]).includes(p.image), { path: ["image"], message: "Visuel non autorisé." });

/** Publication : officielle (admin) ou au nom de sa structure (gestionnaire d'une structure vérifiée). */
export async function createPostAction(input: unknown): Promise<FeedResult> {
  const v = await getViewer();
  if (!v) return fail("Connectez-vous.");
  const p = postSchema.safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  const official = v.role === "admin";
  if (!official) {
    if (!v.structure || v.structure.status !== "VERIFIED") return fail("Seuls l’équipe RushXP et les gestionnaires de structures vérifiées publient dans le fil.");
    if (p.data.kind !== "STRUCTURE") return fail("Les structures publient des actualités de type « Structure ».");
  }
  const post = await db.post.create({
    data: {
      authorId: v.id,
      structureId: official ? null : v.structure!.id,
      official,
      kind: p.data.kind,
      title: p.data.title,
      body: p.data.body || null,
      image: p.data.image || null,
      pinned: official && p.data.pinned,
      pollEndsAt: p.data.kind === "SONDAGE" ? new Date(Date.now() + 10 * 86_400_000) : null,
      options: p.data.kind === "SONDAGE" ? { create: p.data.options.map((label, order) => ({ label, order })) } : undefined,
    },
  });
  await db.auditLog.create({ data: { actorId: v.id, action: "post.create", target: `post:${post.id}` } });
  revalidatePath("/actualites");
  return { ok: true, id: post.id, message: "Publication en ligne." };
}

export async function toggleLikeAction(postId: string): Promise<FeedResult> {
  const v = await getViewer();
  if (!v) return fail("Connectez-vous pour aimer une publication.");
  const key = { postId_userId: { postId, userId: v.id } };
  const existing = await db.postLike.findUnique({ where: key });
  if (existing) await db.postLike.delete({ where: key });
  else await db.postLike.create({ data: { postId, userId: v.id } });
  revalidatePath("/actualites");
  return { ok: true };
}

export async function addCommentAction(input: { postId: string; text: string; parentId?: string }): Promise<FeedResult> {
  const v = await getViewer();
  if (!v) return fail("Connectez-vous pour commenter.");
  const text = input.text.trim();
  if (text.length < 2) return fail("Commentaire trop court.");
  if (text.length > 600) return fail("600 caractères maximum.");
  const recent = await db.postComment.count({ where: { authorId: v.id, createdAt: { gt: new Date(Date.now() - 60_000) } } });
  if (recent >= 5) return fail("Trop de commentaires. Patientez une minute.");
  const post = await db.post.findUnique({ where: { id: input.postId }, select: { id: true } });
  if (!post) return fail("Publication introuvable.");
  await db.postComment.create({ data: { postId: post.id, authorId: v.id, text, parentId: input.parentId ?? null } });
  revalidatePath("/actualites");
  return { ok: true };
}

export async function reportCommentAction(id: string): Promise<FeedResult> {
  const v = await getViewer();
  if (!v) return fail("Connectez-vous pour signaler.");
  await db.postComment.updateMany({ where: { id, NOT: { authorId: v.id } }, data: { reported: true } });
  return { ok: true, message: "Commentaire signalé à la modération." };
}

export async function deleteCommentAction(id: string): Promise<FeedResult> {
  const v = await getViewer();
  if (!v) return fail("Session expirée.");
  const c = await db.postComment.findUnique({ where: { id } });
  if (!c) return fail("Commentaire introuvable.");
  if (c.authorId !== v.id && v.role !== "admin" && v.role !== "arbitre") return fail("Action non autorisée.");
  await db.postComment.deleteMany({ where: { OR: [{ id }, { parentId: id }] } });
  if (c.authorId !== v.id) await db.auditLog.create({ data: { actorId: v.id, action: "comment.delete", target: `comment:${id}`, before: { text: c.text } } });
  revalidatePath("/actualites");
  return { ok: true };
}

export async function votePollAction(input: { postId: string; optionId: string }): Promise<FeedResult> {
  const v = await getViewer();
  if (!v) return fail("Connectez-vous pour voter.");
  const opt = await db.pollOption.findUnique({ where: { id: input.optionId }, include: { post: { select: { id: true, pollEndsAt: true } } } });
  if (!opt || opt.post.id !== input.postId) return fail("Option invalide.");
  if (opt.post.pollEndsAt && opt.post.pollEndsAt < new Date()) return fail("Sondage clos.");
  await db.pollVote.upsert({
    where: { postId_userId: { postId: input.postId, userId: v.id } },
    create: { postId: input.postId, userId: v.id, optionId: opt.id },
    update: { optionId: opt.id },
  });
  revalidatePath("/actualites");
  return { ok: true };
}

export async function deletePostAction(id: string): Promise<FeedResult> {
  const v = await getViewer();
  if (!v) return fail("Session expirée.");
  const p = await db.post.findUnique({ where: { id } });
  if (!p) return fail("Publication introuvable.");
  if (p.authorId !== v.id && v.role !== "admin") return fail("Action non autorisée.");
  await db.post.delete({ where: { id } });
  await db.auditLog.create({ data: { actorId: v.id, action: "post.delete", target: `post:${id}`, before: { title: p.title } } });
  revalidatePath("/actualites");
  return { ok: true };
}

export async function togglePinAction(id: string): Promise<FeedResult> {
  const v = await getViewer();
  if (!v || v.role !== "admin") return fail("Réservé aux administrateurs.");
  const p = await db.post.findUnique({ where: { id } });
  if (!p) return fail("Publication introuvable.");
  await db.post.update({ where: { id }, data: { pinned: !p.pinned } });
  revalidatePath("/actualites");
  return { ok: true };
}
