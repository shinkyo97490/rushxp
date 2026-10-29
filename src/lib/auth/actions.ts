"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { db } from "@/lib/db";
import {
  GAME_LINK,
  gamesStepSchema,
  profileStepSchema,
  signInSchema,
  signUpSchema,
  structureStepSchema,
  toFieldErrors,
  type FieldErrors,
} from "@/lib/validation";
import { auth } from "./auth";
import { getViewer } from "./viewer";

export type ActionResult = { ok: true } | { ok: false; errors: FieldErrors };

const fail = (errors: FieldErrors): ActionResult => ({ ok: false, errors });

/** Chemin de retour interne uniquement (évite les redirections ouvertes). */
function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signInAction(input: { identifier: string; password: string; next?: string }): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fail(toFieldErrors(parsed.error));
  let email = parsed.data.identifier.toLowerCase();
  if (!email.includes("@")) {
    const u = await db.user.findFirst({ where: { pseudo: { equals: parsed.data.identifier, mode: "insensitive" } }, select: { email: true } });
    if (!u) return fail({ _: "Identifiants incorrects." });
    email = u.email;
  }
  try {
    await auth.api.signInEmail({ body: { email, password: parsed.data.password }, headers: await headers() });
  } catch (e) {
    if (e instanceof APIError && e.status === "FORBIDDEN") return fail({ _: "Ce compte est suspendu. Contactez l’équipe RushXP." });
    if (e instanceof APIError && e.status === "TOO_MANY_REQUESTS") return fail({ _: "Trop de tentatives. Réessayez dans une minute." });
    return fail({ _: "Identifiants incorrects." });
  }
  redirect(safeNext(input.next));
}

export async function signUpAction(input: { email: string; pseudo: string; password: string; terms: boolean }): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return fail(toFieldErrors(parsed.error));
  const { email, pseudo, password } = parsed.data;
  const [byEmail, byPseudo] = await Promise.all([
    db.user.findUnique({ where: { email }, select: { id: true } }),
    db.user.findFirst({ where: { pseudo: { equals: pseudo, mode: "insensitive" } }, select: { id: true } }),
  ]);
  const errors: FieldErrors = {};
  if (byEmail) errors.email = "Un compte existe déjà avec cette adresse.";
  if (byPseudo) errors.pseudo = "Ce pseudo est déjà pris.";
  if (Object.keys(errors).length) return fail(errors);
  try {
    const res = await auth.api.signUpEmail({ body: { email, password, name: pseudo }, headers: await headers() });
    await db.user.update({ where: { id: res.user.id }, data: { termsAcceptedAt: new Date() } });
  } catch (e) {
    console.error("Inscription impossible", e);
    return fail({ _: "Inscription impossible pour le moment. Réessayez." });
  }
  return { ok: true };
}

async function viewerOrFail() {
  const v = await getViewer();
  if (!v) throw new Error("Session expirée : reconnectez-vous.");
  return v;
}

export async function saveGamesAction(input: { games: string[]; links: Record<string, string> }): Promise<ActionResult> {
  const v = await viewerOrFail();
  const parsed = gamesStepSchema.safeParse(input);
  if (!parsed.success) return fail(toFieldErrors(parsed.error));
  const { games, links } = parsed.data;
  const errors: FieldErrors = {};
  for (const g of games) {
    const externalId = links[g];
    if (!externalId) continue;
    const taken = await db.gameAccount.findFirst({ where: { game: g, externalId, NOT: { userId: v.id } }, select: { userId: true } });
    if (taken) errors[`links.${g}`] = "Cet identifiant est déjà lié à un autre compte RushXP.";
  }
  if (Object.keys(errors).length) return fail(errors);
  await db.$transaction([
    db.gameAccount.deleteMany({ where: { userId: v.id, game: { notIn: games } } }),
    ...games.map((g) =>
      db.gameAccount.upsert({
        where: { userId_game: { userId: v.id, game: g } },
        // Identifiant déclaré : la vérification passera par l'OAuth de l'éditeur (verifiedAt reste vide).
        create: { userId: v.id, game: g, provider: GAME_LINK[g].provider, externalId: links[g] || null },
        update: { externalId: links[g] || null, verifiedAt: null },
      }),
    ),
  ]);
  return { ok: true };
}

export async function saveProfileAction(input: { intent: string; region: string; availability: string[] }): Promise<ActionResult> {
  const v = await viewerOrFail();
  const parsed = profileStepSchema.safeParse(input);
  if (!parsed.success) return fail(toFieldErrors(parsed.error));
  await db.user.update({ where: { id: v.id }, data: parsed.data });
  return { ok: true };
}

export async function finishOnboardingAction(input: { path: string; code?: string }): Promise<ActionResult> {
  const v = await viewerOrFail();
  const parsed = structureStepSchema.safeParse(input);
  if (!parsed.success) return fail(toFieldErrors(parsed.error));
  if (parsed.data.path === "join") {
    const s = await db.structure.findUnique({ where: { inviteCode: parsed.data.code }, select: { id: true, staff: { select: { userId: true } } } });
    if (!s) return fail({ code: "Aucune structure ne correspond à ce code." });
    await db.$transaction([
      db.invitation.upsert({
        where: { structureId_userId: { structureId: s.id, userId: v.id } },
        create: { structureId: s.id, userId: v.id, invitedById: v.id, kind: "REQUEST" },
        update: {},
      }),
      db.notification.createMany({
        data: s.staff.map((m) => ({ userId: m.userId, category: "recrutement", text: `${v.pseudo} demande à rejoindre votre structure.`, link: "/recrutement" })),
      }),
    ]);
  }
  await db.user.update({ where: { id: v.id }, data: { onboardedAt: new Date() } });
  return { ok: true };
}

export async function signOutAction() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    /* session déjà expirée */
  }
  redirect("/");
}
