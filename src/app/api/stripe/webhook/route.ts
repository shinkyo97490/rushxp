import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { integrations } from "@/lib/integrations";
import { verifyStripeSignature } from "@/lib/integrations/stripe";
import { euros } from "@/lib/lan/queries";

/**
 * Webhook Stripe : seule source de vérité pour confirmer un paiement.
 * Événements écoutés : checkout.session.completed, checkout.session.expired.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook non configuré." }, { status: 503 });
  const payload = await req.text();
  if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  const event = JSON.parse(payload) as { type: string; data: { object: { id: string; payment_status?: string; metadata?: Record<string, string> } } };
  const s = event.data.object;
  const reg = await db.lanRegistration.findFirst({ where: { OR: [{ checkoutId: s.id }, { id: s.metadata?.registration ?? "" }] }, include: { tournament: { include: { lan: true } } } });
  if (!reg) return NextResponse.json({ received: true });

  if (event.type === "checkout.session.completed" && s.payment_status === "paid") {
    const ok = await db.lanRegistration.updateMany({ where: { id: reg.id, status: "PENDING" }, data: { status: "PAID", paidAt: new Date(), checkoutId: s.id } });
    if (ok.count) {
      const lan = reg.tournament.lan;
      await db.notification.create({ data: { userId: reg.createdById, category: "matchs", text: `Inscription confirmée : ${lan.name} · commande ${reg.order}. Présentez votre billet au check-in.`, link: `/lan?e=${lan.slug}&tab=form&ok=${reg.id}` } });
      const user = await db.user.findUnique({ where: { id: reg.createdById }, select: { email: true, pseudo: true } });
      if (user)
        await integrations.email
          .send({
            to: user.email,
            subject: `Inscription confirmée · ${lan.name}`,
            text: `Bonjour ${user.pseudo},\n\nVotre inscription « ${reg.name} » à ${lan.name} est confirmée.\nCommande ${reg.order} · ${euros(reg.amountCents)}.\nLieu : ${lan.place}.\n\nPrésentez ce message et une pièce d’identité au check-in.\n\nL’équipe RushXP`,
          })
          .catch((e) => console.error("E-mail de confirmation LAN", e));
    }
  } else if (event.type === "checkout.session.expired") {
    await db.lanRegistration.updateMany({ where: { id: reg.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  }
  return NextResponse.json({ received: true });
}
