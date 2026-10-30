import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getViewer } from "@/lib/auth/viewer";
import { paymentMode } from "@/lib/lan/queries";

/**
 * Retour du paiement. En mode simulé (hors production), le retour confirme directement le paiement de
 * l'auteur de l'inscription. Avec Stripe, la confirmation viendra du webhook signé (jamais de ce retour).
 */
export async function GET(req: NextRequest) {
  const u = req.nextUrl;
  const reg = await db.lanRegistration.findUnique({ where: { id: u.searchParams.get("reg") ?? "" }, include: { tournament: { include: { lan: true } } } });
  if (!reg) return NextResponse.redirect(new URL("/lan", u));
  const back = new URL(`/lan?e=${reg.tournament.lan.slug}&tab=form&ok=${reg.id}`, u);
  const v = await getViewer();
  if (
    paymentMode() === "mock" &&
    u.searchParams.get("mock") === "1" &&
    reg.status === "PENDING" &&
    reg.checkoutId === u.searchParams.get("session_id") &&
    v?.id === reg.createdById
  ) {
    await db.$transaction([
      db.lanRegistration.update({ where: { id: reg.id }, data: { status: "PAID", paidAt: new Date() } }),
      db.notification.create({
        data: {
          userId: reg.createdById,
          category: "matchs",
          text: `Inscription confirmée : ${reg.tournament.lan.name} · commande ${reg.order}. Présentez votre billet au check-in.`,
          link: `/lan?e=${reg.tournament.lan.slug}&tab=form&ok=${reg.id}`,
        },
      }),
    ]);
  }
  return NextResponse.redirect(back);
}
