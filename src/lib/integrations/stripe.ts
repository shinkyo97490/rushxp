import { createHmac, timingSafeEqual } from "node:crypto";
import type { CheckoutInput, Payments } from "./index";

/** Origine publique du site (URL absolues exigées par Stripe). */
export function siteOrigin() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function stripe(path: string, body?: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: body ? new URLSearchParams(body) : undefined,
  });
  const json = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe : ${json.error?.message ?? res.status}`);
  return json;
}

/** Paiement Stripe Checkout (API REST, sans SDK). La confirmation arrive par le webhook signé. */
export const stripePayments: Payments = {
  async createCheckout(input: CheckoutInput) {
    const abs = (u: string) => (u.startsWith("http") ? u : `${siteOrigin()}${u}`);
    const success = new URL(abs(input.successUrl));
    success.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
    const body: Record<string, string> = {
      mode: "payment",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": input.currency,
      "line_items[0][price_data][unit_amount]": String(input.amountCents),
      "line_items[0][price_data][product_data][name]": input.description.slice(0, 250),
      customer_email: input.customerEmail,
      success_url: success.toString().replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}"),
      cancel_url: abs(input.cancelUrl),
      locale: "fr",
    };
    for (const [k, v] of Object.entries(input.metadata)) body[`metadata[${k}]`] = v;
    const s = await stripe("checkout/sessions", body);
    return { id: String(s.id), url: String(s.url) };
  },
  async refund(sessionId: string, amountCents?: number) {
    const s = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (!s.payment_intent) throw new Error("Stripe : paiement introuvable pour cette session.");
    const r = await stripe("refunds", { payment_intent: String(s.payment_intent), ...(amountCents ? { amount: String(amountCents) } : {}) });
    return { id: String(r.id), status: r.status === "succeeded" ? "succeeded" : "pending" };
  },
};

/**
 * Vérifie l'en-tête `Stripe-Signature` (t=…, v1=…) : HMAC SHA-256 de « t.payload » avec le secret du webhook,
 * à moins de `toleranceSec` secondes.
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
