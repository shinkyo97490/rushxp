import "server-only";
import { db } from "@/lib/db";
import type { AdSlot } from "@/generated/prisma/client";

export const SLOT_LABEL: Record<AdSlot, string> = {
  HOME_BANNER: "Bannière d’accueil",
  FEED_CARD: "Carte sponsorisée (fil)",
  COMPETITION_BAND: "Bandeau de compétition",
  SIDE_BLOCK: "Bloc latéral",
  EVENT_VISUAL: "Visuel événementiel",
};

/**
 * Sert une campagne active pour un emplacement (dates, plafond) et compte l'impression.
 * Le lien passe par /api/ads/click, qui compte le clic avant de rediriger.
 */
export async function serveAd(slot: AdSlot) {
  const now = new Date();
  const list = await db.adCampaign.findMany({
    where: { slot, active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }], partner: { active: true } },
    include: { partner: { select: { name: true, logoUrl: true, category: true } } },
  });
  const eligible = list.filter((c) => c.cap == null || c.impressions < c.cap);
  if (!eligible.length) return null;
  // Rotation : la campagne la moins vue d'abord.
  const c = eligible.sort((a, b) => a.impressions - b.impressions)[0];
  await db.adCampaign.update({ where: { id: c.id }, data: { impressions: { increment: 1 } } });
  return { id: c.id, title: c.title, body: c.body, imageUrl: c.imageUrl, href: `/api/ads/click?c=${c.id}`, partner: c.partner };
}

export async function activePartners(bandOnly = false) {
  return db.partner.findMany({ where: { active: true, ...(bandOnly ? { band: true } : {}) }, orderBy: [{ level: "asc" }, { order: "asc" }, { name: "asc" }] });
}
