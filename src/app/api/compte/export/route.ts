import { getViewer } from "@/lib/auth/viewer";
import { db } from "@/lib/db";

/** Export RGPD : toutes les données personnelles du compte connecté, en JSON. */
export async function GET() {
  const v = await getViewer();
  if (!v) return new Response("Non connecté", { status: 401 });
  const data = await db.user.findUniqueOrThrow({
    where: { id: v.id },
    select: {
      pseudo: true,
      email: true,
      region: true,
      bio: true,
      intent: true,
      availability: true,
      privacy: true,
      notifPrefs: true,
      createdAt: true,
      termsAcceptedAt: true,
      gameAccounts: { select: { game: true, provider: true, externalId: true, verifiedAt: true } },
      contracts: { select: { structure: { select: { name: true } }, joinedAt: true, leftAt: true } },
      memberships: { select: { roster: { select: { name: true, game: true } }, role: true, joinedAt: true, leftAt: true } },
      structureStaff: { select: { structure: { select: { name: true } }, role: true } },
      recruitAds: { select: { game: true, role: true, text: true, createdAt: true } },
      notifications: { select: { category: true, text: true, createdAt: true, readAt: true } },
      messages: { select: { text: true, createdAt: true } },
      sessions: { select: { createdAt: true, userAgent: true, ipAddress: true } },
    },
  });
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="rushxp-${v.pseudo}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
