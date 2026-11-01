"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { toFieldErrors, type FieldErrors } from "@/lib/validation";
import { getCompetitionTexts, HOME_BLOCKS } from "./settings";

type R = { ok: true; message?: string } | { ok: false; errors: FieldErrors };
const fail = (m: string, f = "_"): R => ({ ok: false, errors: { [f]: m } });

async function admin() {
  const v = await getViewer();
  return v?.role === "admin" ? v : null;
}
async function audit(actorId: string, action: string, target: string, after?: object) {
  await db.auditLog.create({ data: { actorId, action, target, after } });
}
function refresh() {
  for (const p of ["/", "/admin", "/partenaires", "/actualites", "/competitions"]) revalidatePath(p);
}

const url = z.string().trim().regex(/^(\/|https:\/\/)\S+$/, "Chemin /assets/… ou lien https://");

// ─── Page d'accueil ──────────────────────────────────────────────

export async function saveHomeAction(input: unknown): Promise<R> {
  const v = await admin();
  if (!v) return fail("Réservé aux administrateurs.");
  const p = z
    .object({
      title: z.string().trim().min(3, "Titre requis.").max(60),
      accent: z.string().trim().max(60),
      subtitle: z.string().trim().max(300),
      heroImage: url,
      bannerLan: z.string().trim().max(80),
      blocks: z.array(z.enum(HOME_BLOCKS)),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  const value = { ...p.data, bannerLan: p.data.bannerLan || null };
  await db.siteSetting.upsert({ where: { key: "home" }, create: { key: "home", value }, update: { value } });
  await audit(v.id, "site.home", "setting:home", value);
  refresh();
  return { ok: true, message: "Page d’accueil publiée." };
}

export async function setMaintenanceAction(input: { on: boolean; message: string }): Promise<R> {
  const v = await admin();
  if (!v) return fail("Réservé aux administrateurs.");
  const value = { on: input.on, message: input.message.trim().slice(0, 300) };
  await db.siteSetting.upsert({ where: { key: "maintenance" }, create: { key: "maintenance", value }, update: { value } });
  await audit(v.id, input.on ? "site.maintenance.on" : "site.maintenance.off", "setting:maintenance", value);
  revalidatePath("/", "layout");
  return { ok: true, message: input.on ? "Mode maintenance activé : seuls les administrateurs voient le site." : "Mode maintenance désactivé." };
}

// ─── Partenaires ─────────────────────────────────────────────────

const partnerSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Nom requis.").max(60),
  category: z.string().trim().min(2, "Catégorie requise.").max(60),
  level: z.enum(["MAIN", "OFFICIAL", "ASSOCIATIVE"]),
  site: z.union([z.literal(""), z.string().trim().url("Lien invalide.").startsWith("https://", "Lien https:// requis.")]),
  description: z.string().trim().max(400),
  logoUrl: url,
  band: z.boolean(),
  active: z.boolean(),
  order: z.coerce.number().int().min(0).max(99),
});

export async function savePartnerAction(input: unknown): Promise<R> {
  const v = await admin();
  if (!v) return fail("Réservé aux administrateurs.");
  const p = partnerSchema.safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  const { id, ...d } = p.data;
  const data = { ...d, site: d.site || null };
  if (id) {
    await db.partner.update({ where: { id }, data });
    await audit(v.id, "partner.update", `partner:${id}`, data);
  } else {
    let slug = d.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "partenaire";
    if (await db.partner.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const created = await db.partner.create({ data: { ...data, slug } });
    await audit(v.id, "partner.create", `partner:${created.id}`, data);
  }
  refresh();
  return { ok: true, message: `Partenaire « ${d.name} » enregistré.` };
}

// ─── Campagnes publicitaires ─────────────────────────────────────

const day = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")]);
const campaignSchema = z.object({
  id: z.string().optional(),
  partnerId: z.string().min(1, "Choisissez un partenaire."),
  name: z.string().trim().min(3, "Nom requis.").max(80),
  slot: z.enum(["HOME_BANNER", "FEED_CARD", "COMPETITION_BAND", "SIDE_BLOCK", "EVENT_VISUAL"]),
  imageUrl: z.union([z.literal(""), url]),
  title: z.string().trim().min(3, "Texte requis.").max(120),
  body: z.string().trim().max(300),
  link: url,
  startsOn: day.refine((x) => x !== "", "Date de début requise."),
  endsOn: day,
  cap: z.union([z.literal(""), z.coerce.number().int().min(100, "100 minimum.")]),
  active: z.boolean(),
});

export async function saveCampaignAction(input: unknown): Promise<R> {
  const v = await admin();
  if (!v) return fail("Réservé aux administrateurs.");
  const p = campaignSchema.safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  const d = p.data;
  const startsAt = new Date(`${d.startsOn}T00:00:00+04:00`);
  const endsAt = d.endsOn ? new Date(`${d.endsOn}T23:59:59+04:00`) : null;
  if (endsAt && endsAt < startsAt) return fail("La fin précède le début.", "endsOn");
  if ((d.slot === "HOME_BANNER" || d.slot === "FEED_CARD") && !d.imageUrl) return fail("Visuel requis pour cet emplacement.", "imageUrl");
  const data = { partnerId: d.partnerId, name: d.name, slot: d.slot, imageUrl: d.imageUrl || null, title: d.title, body: d.body || null, link: d.link, startsAt, endsAt, cap: d.cap === "" ? null : d.cap, active: d.active };
  if (d.id) await db.adCampaign.update({ where: { id: d.id }, data });
  else await db.adCampaign.create({ data });
  await audit(v.id, d.id ? "campaign.update" : "campaign.create", `campaign:${d.id ?? "new"}`, { name: d.name, slot: d.slot });
  refresh();
  return { ok: true, message: `Campagne « ${d.name} » enregistrée.` };
}

// ─── Compétitions (présentation par jeu) ─────────────────────────

export async function saveCompetitionTextAction(input: { game: string; comp: string; desc: string; photo: string }): Promise<R> {
  const v = await admin();
  if (!v) return fail("Réservé aux administrateurs.");
  const p = z
    .object({ game: z.string(), comp: z.string().trim().min(3, "Nom requis.").max(60), desc: z.string().trim().min(10, "Description requise.").max(400), photo: url })
    .safeParse(input);
  if (!p.success) return { ok: false, errors: toFieldErrors(p.error) };
  const all = await getCompetitionTexts();
  if (!(p.data.game in all)) return fail("Jeu inconnu.");
  const value: Record<string, { comp: string; desc: string; photo: string }> = { ...all, [p.data.game]: { comp: p.data.comp, desc: p.data.desc, photo: p.data.photo } };
  await db.siteSetting.upsert({ where: { key: "competitions" }, create: { key: "competitions", value: value as object }, update: { value: value as object } });
  await audit(v.id, "site.competition", `competition:${p.data.game}`, value[p.data.game]);
  refresh();
  return { ok: true, message: `Page « ${p.data.comp} » publiée.` };
}
