"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { getGame } from "@/lib/data/games";
import { integrations } from "@/lib/integrations";
import { toFieldErrors, type FieldErrors } from "@/lib/validation";
import { isSoloGame, paymentMode, SERVICE_FEE_CENTS } from "./queries";

export type LanResultMsg = { ok: true; message?: string; url?: string } | { ok: false; errors: FieldErrors };
const fail = (m: string, field = "_"): LanResultMsg => ({ ok: false, errors: { [field]: m } });

// ─── Inscription d'un joueur ou d'une équipe ─────────────────────

/** Crée (ou reprend) une inscription en attente et renvoie l'URL de paiement. La place est réservée jusqu'au paiement. */
export async function startLanRegistrationAction(input: { tournamentId: string; rosterId?: string; accept: boolean }): Promise<LanResultMsg> {
  const v = await getViewer();
  if (!v) return fail("Connectez-vous pour vous inscrire.");
  if (!input.accept) return fail("Acceptez le règlement pour continuer.", "accept");
  const mode = paymentMode();
  if (mode === "off") return fail("Le paiement en ligne n’est pas encore ouvert. Réessayez prochainement.");

  const t = await db.lanTournament.findUnique({
    where: { id: input.tournamentId },
    include: { lan: true, _count: { select: { registrations: { where: { status: { in: ["PENDING", "PAID"] } } } } } },
  });
  if (!t || t.lan.status === "DRAFT") return fail("Tournoi introuvable.");
  if (t.lan.status !== "OPEN") return fail("Les inscriptions ne sont pas ouvertes.");
  if (t.priceCents == null) return fail("Le tarif de ce tournoi n’est pas encore annoncé.");
  const game = getGame(t.game);

  let entityId: string, name: string, structureId: string | null, members: string[];
  if (isSoloGame(t.game)) {
    entityId = v.id;
    name = v.pseudo;
    structureId = v.club?.id ?? null;
    members = [v.id];
  } else {
    if (!input.rosterId) return fail("Choisissez l’équipe à inscrire.", "rosterId");
    const r = await db.roster.findUnique({
      where: { id: input.rosterId },
      include: { members: { where: { leftAt: null } }, structure: { select: { id: true, name: true, staff: { select: { userId: true } } } } },
    });
    if (!r || r.game !== t.game) return fail("Équipe introuvable pour ce jeu.", "rosterId");
    if (r.captainId !== v.id && !r.structure.staff.some((s) => s.userId === v.id))
      return fail("Seul le capitaine ou le gestionnaire de la structure peut inscrire une équipe.", "rosterId");
    const starters = r.members.filter((m) => m.role === "STARTER");
    const size = game?.rosterSize ?? 1;
    if (starters.length < size) return fail(`Équipe incomplète : ${size} titulaires requis.`, "rosterId");
    entityId = r.id;
    name = r.name === r.structure.name ? r.structure.name : `${r.structure.name} · ${r.name}`;
    structureId = r.structure.id;
    members = starters.map((m) => m.userId);
  }

  const existing = await db.lanRegistration.findUnique({ where: { tournamentId_entityId: { tournamentId: t.id, entityId } } });
  if (existing?.status === "PAID") return fail("Déjà inscrit à ce tournoi.");
  const active = existing && existing.status === "PENDING";
  if (!active && t._count.registrations >= t.capacity) return fail("Complet : plus aucune place disponible.");

  const amountCents = t.priceCents + SERVICE_FEE_CENTS;
  const order = existing?.order ?? `RXP-LAN-${randomInt(10000, 99999)}`;
  const reg = existing
    ? await db.lanRegistration.update({ where: { id: existing.id }, data: { status: "PENDING", name, structureId, members, amountCents, createdById: v.id } })
    : await db.lanRegistration.create({ data: { tournamentId: t.id, entityId, name, structureId, members, order, amountCents, createdById: v.id } });

  const checkout = await integrations.payments.createCheckout({
    amountCents,
    currency: "eur",
    description: `${t.lan.name} · ${game?.name ?? t.game} · ${name}`,
    customerEmail: v.email,
    metadata: { registration: reg.id, order },
    successUrl: `/lan/paiement?reg=${reg.id}`,
    cancelUrl: `/lan?e=${t.lan.slug}&tab=form`,
  });
  await db.lanRegistration.update({ where: { id: reg.id }, data: { checkoutId: checkout.id } });
  return { ok: true, url: checkout.url };
}

/** Annulation : libère la place ; remboursement si payé et avant la date limite. */
export async function cancelLanRegistrationAction(id: string): Promise<LanResultMsg> {
  const v = await getViewer();
  if (!v) return fail("Session expirée.");
  const reg = await db.lanRegistration.findUnique({ where: { id }, include: { tournament: { include: { lan: true } } } });
  if (!reg || (reg.createdById !== v.id && v.role !== "admin")) return fail("Inscription introuvable.");
  if (reg.status === "PENDING") {
    await db.lanRegistration.update({ where: { id }, data: { status: "CANCELLED" } });
  } else if (reg.status === "PAID") {
    const lan = reg.tournament.lan;
    if (v.role !== "admin" && (!lan.refundUntil || new Date() > lan.refundUntil)) return fail("La date limite de remboursement est passée.");
    if (reg.checkoutId) await integrations.payments.refund(reg.checkoutId, reg.amountCents);
    await db.lanRegistration.update({ where: { id }, data: { status: "REFUNDED" } });
  } else return fail("Cette inscription est déjà annulée.");
  revalidatePath("/lan");
  return { ok: true, message: reg.status === "PAID" ? "Inscription annulée : remboursement lancé." : "Inscription annulée : la place est libérée." };
}

// ─── Administration (CMS LAN) ────────────────────────────────────

async function requireAdmin() {
  const v = await getViewer();
  return v?.role === "admin" ? v : null;
}
async function audit(actorId: string, action: string, target: string, after?: object) {
  await db.auditLog.create({ data: { actorId, action, target, after } });
}
function adminDone(message: string): LanResultMsg {
  revalidatePath("/admin");
  revalidatePath("/lan");
  revalidatePath("/");
  return { ok: true, message };
}

const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/, "Date invalide.")]);
const toDate = (s: string) => (s ? new Date(s.length === 10 ? `${s}T00:00:00+04:00` : `${s}:00+04:00`) : null);
const euroCents = z.union([z.literal(""), z.coerce.number().min(0, "Montant positif.").max(10000)]);

const lanSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(3, "3 caractères minimum.").max(80),
  organizer: z.string().trim().min(2, "Requis.").max(80),
  place: z.string().trim().min(2, "Requis.").max(120),
  startsAt: date,
  endsAt: date,
  description: z.string().trim().max(2000),
  posterUrl: z.union([z.literal(""), z.string().trim().regex(/^(\/|https:\/\/)/, "URL https:// ou chemin /assets/…")]),
  status: z.enum(["DRAFT", "ANNOUNCED", "OPEN", "CLOSED", "DONE"]),
  refundUntil: date,
  visitorPass: euroCents,
  countsForGeneral: z.boolean(),
  program: z.string().max(4000),
  tournaments: z
    .array(
      z.object({
        game: z.string(),
        format: z.string().trim().min(2, "Format requis.").max(80),
        price: euroCents,
        capacity: z.coerce.number().int().min(2, "2 minimum.").max(256),
        day: z.string().trim().max(40),
      }),
    )
    .max(8),
});

/** « Samedi 21 novembre » sur une ligne, puis « 09:00 Accueil » ; ligne vide entre les jours. */
function programFromText(text: string) {
  const days: { day: string; items: [string, string][] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(\d{1,2}[:h]\d{2})\s+(.+)$/.exec(line);
    if (m && days.length) days[days.length - 1].items.push([m[1].replace("h", ":"), m[2]]);
    else days.push({ day: line, items: [] });
  }
  return days;
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export async function saveLanAction(input: unknown): Promise<LanResultMsg> {
  const v = await requireAdmin();
  if (!v) return fail("Réservé aux administrateurs.");
  const p = lanSchema.safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  const d = p.data;
  const startsAt = toDate(d.startsAt);
  const endsAt = toDate(d.endsAt);
  if (startsAt && endsAt && endsAt < startsAt) return fail("La fin précède le début.", "endsAt");
  if (d.status === "OPEN" && !startsAt) return fail("Indiquez la date avant d’ouvrir les inscriptions.", "startsAt");
  const games = d.tournaments.map((t) => t.game);
  if (new Set(games).size !== games.length) return fail("Un seul tournoi par jeu.", "tournaments");
  if (games.some((g) => !getGame(g))) return fail("Jeu inconnu.", "tournaments");
  if (d.status === "OPEN" && d.tournaments.some((t) => t.price === "")) return fail("Indiquez le tarif de chaque tournoi avant d’ouvrir les inscriptions.", "tournaments");

  const data = {
    name: d.name,
    organizer: d.organizer,
    place: d.place,
    startsAt,
    endsAt,
    description: d.description,
    posterUrl: d.posterUrl || null,
    status: d.status,
    refundUntil: toDate(d.refundUntil),
    visitorPassCents: d.visitorPass === "" ? null : Math.round(d.visitorPass * 100),
    countsForGeneral: d.countsForGeneral,
    program: programFromText(d.program),
  };
  const tours = d.tournaments.map((t) => ({
    game: t.game,
    format: t.format,
    priceCents: t.price === "" ? null : Math.round(t.price * 100),
    capacity: t.capacity,
    day: t.day || null,
  }));

  if (d.id) {
    const before = await db.lanEvent.findUnique({ where: { id: d.id }, include: { tournaments: { include: { _count: { select: { registrations: true, results: true } } } } } });
    if (!before) return fail("Événement introuvable.");
    const removed = before.tournaments.filter((t) => !games.includes(t.game));
    if (removed.some((t) => t._count.registrations || t._count.results)) return fail("Un tournoi qui a des inscrits ou des résultats ne peut pas être retiré.", "tournaments");
    await db.$transaction([
      db.lanEvent.update({ where: { id: d.id }, data }),
      db.lanTournament.deleteMany({ where: { id: { in: removed.map((t) => t.id) } } }),
      ...tours.map((t) => db.lanTournament.upsert({ where: { lanId_game: { lanId: d.id!, game: t.game } }, create: { lanId: d.id!, ...t }, update: t })),
    ]);
    await audit(v.id, "lan.update", `lan:${d.id}`, { name: d.name, status: d.status });
    return adminDone(`« ${d.name} » enregistré.`);
  }
  let slug = slugify(d.name) || "lan";
  if (await db.lanEvent.findUnique({ where: { slug } })) slug = `${slug}-${randomInt(100, 999)}`;
  const lan = await db.lanEvent.create({ data: { ...data, slug, tournaments: { create: tours } } });
  await audit(v.id, "lan.create", `lan:${lan.id}`, { name: d.name, status: d.status });
  return adminDone(`« ${d.name} » créé.`);
}

/** Résultats d'un tournoi : liste ordonnée des inscriptions (1er en premier). Arbitres et admins. */
export async function saveLanResultsAction(input: { tournamentId: string; ranking: string[] }): Promise<LanResultMsg> {
  const v = await getViewer();
  if (!v || (v.role !== "admin" && v.role !== "arbitre")) return fail("Réservé aux arbitres.");
  const t = await db.lanTournament.findUnique({ where: { id: input.tournamentId }, include: { lan: true, registrations: { where: { status: "PAID" } } } });
  if (!t) return fail("Tournoi introuvable.");
  if (t.lan.status === "DONE") return fail("Résultats déjà validés : rouvrez l’événement pour les modifier.");
  const ids = input.ranking.filter(Boolean);
  if (new Set(ids).size !== ids.length) return fail("Une même inscription apparaît deux fois.");
  const regs = new Map(t.registrations.map((r) => [r.id, r]));
  if (ids.some((id) => !regs.has(id))) return fail("Seules les inscriptions payées peuvent être classées.");
  await db.$transaction([
    db.lanResult.deleteMany({ where: { tournamentId: t.id } }),
    db.lanResult.createMany({ data: ids.map((id, i) => ({ tournamentId: t.id, place: i + 1, name: regs.get(id)!.name, structureId: regs.get(id)!.structureId })) }),
  ]);
  await audit(v.id, "lan.results", `lan-tournament:${t.id}`, { ranking: ids.map((id) => regs.get(id)!.name) });
  return adminDone(`Classement enregistré (${ids.length} place(s)).`);
}

/** Validation finale : l'événement passe « Terminé » et ses points comptent au classement général. */
export async function validateLanResultsAction(lanId: string): Promise<LanResultMsg> {
  const v = await requireAdmin();
  if (!v) return fail("Réservé aux administrateurs.");
  const lan = await db.lanEvent.findUnique({ where: { id: lanId }, include: { tournaments: { include: { _count: { select: { results: true, registrations: { where: { status: "PAID" } } } } } } } });
  if (!lan) return fail("Événement introuvable.");
  // Un tournoi sans inscrit payé n'a pas de classement à saisir.
  const missing = lan.tournaments.filter((t) => t._count.registrations > 0 && !t._count.results);
  if (missing.length) return fail(`Classement manquant : ${missing.map((t) => getGame(t.game)?.name ?? t.game).join(", ")}.`);
  await db.lanEvent.update({ where: { id: lanId }, data: { status: "DONE", resultsAt: new Date() } });
  await audit(v.id, "lan.validate", `lan:${lanId}`);
  return adminDone(`Résultats de « ${lan.name} » validés et publiés.`);
}
