/**
 * Intégrations externes, isolées derrière des interfaces. En développement (ou tant qu'une intégration
 * n'est pas configurée), une implémentation « mock » prend le relais : le site reste utilisable et testable.
 * Les adaptateurs réels (Ably, Stripe, Vercel Blob, Resend, moteur OCR) sont branchés lot par lot.
 */

// ─── Temps réel (chat de match, veto, check-in, notifications) ──

export interface Realtime {
  publish(channel: string, event: string, data: unknown): Promise<void>;
}

// ─── OCR / vision (captures de fin de partie) ───────────────────

export interface OcrField {
  key: string;
  value: string;
  confidence: number; // 0 → 1, par champ
}
export interface Ocr {
  analyze(input: { game: string; fileUrl: string }): Promise<{ fields: OcrField[]; confidence: number }>;
}

// ─── Paiement (inscriptions LAN, Stripe) ────────────────────────

export interface CheckoutInput {
  amountCents: number;
  currency: "eur";
  description: string;
  customerEmail: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}
export interface Payments {
  createCheckout(input: CheckoutInput): Promise<{ id: string; url: string }>;
  refund(paymentId: string, amountCents?: number): Promise<{ id: string; status: "succeeded" | "pending" }>;
}

// ─── Stockage (captures, logos, médias) ─────────────────────────

export interface Storage {
  put(key: string, body: ArrayBuffer | Uint8Array, contentType: string): Promise<{ url: string }>;
}

// ─── E-mails transactionnels ────────────────────────────────────

export interface Email {
  send(message: { to: string; subject: string; text: string }): Promise<{ id: string }>;
}

// ─── Implémentations de développement ───────────────────────────

const CONFIDENCE_THRESHOLD = 0.8;

export const mocks = {
  /** Diffusion en mémoire (une instance) : suffisant pour développer et tester. */
  realtime: (() => {
    const listeners = new Map<string, ((event: string, data: unknown) => void)[]>();
    return {
      async publish(channel: string, event: string, data: unknown) {
        for (const l of listeners.get(channel) ?? []) l(event, data);
      },
      subscribe(channel: string, fn: (event: string, data: unknown) => void) {
        listeners.set(channel, [...(listeners.get(channel) ?? []), fn]);
        return () => listeners.set(channel, (listeners.get(channel) ?? []).filter((x) => x !== fn));
      },
    };
  })(),

  /** Lecture simulée : confiance élevée, sauf si le nom de fichier contient « flou » (pour tester la vérification arbitre). */
  ocr: {
    async analyze({ fileUrl }: { game: string; fileUrl: string }) {
      const low = /flou|blur/i.test(fileUrl);
      const fields: OcrField[] = [
        { key: "winner", value: "A", confidence: low ? 0.71 : 0.98 },
        { key: "score", value: "2-1", confidence: low ? 0.58 : 0.96 },
      ];
      return { fields, confidence: Math.min(...fields.map((f) => f.confidence)) };
    },
  } satisfies Ocr,

  /** Paiement simulé : renvoie directement vers l'URL de succès, marquée `mock=1`. */
  payments: {
    async createCheckout(input: CheckoutInput) {
      const id = `mock_cs_${Math.abs(hash(JSON.stringify(input.metadata)))}`;
      const u = new URL(input.successUrl, "http://localhost");
      u.searchParams.set("session_id", id);
      u.searchParams.set("mock", "1");
      return { id, url: `${u.pathname}${u.search}` };
    },
    async refund(paymentId: string) {
      return { id: `mock_re_${paymentId}`, status: "succeeded" as const };
    },
  } satisfies Payments,

  storage: {
    async put(key: string) {
      return { url: `/mock-storage/${encodeURIComponent(key)}` };
    },
  } satisfies Storage,

  /** Les e-mails simulés sont journalisés et conservés en mémoire. */
  email: (() => {
    const outbox: { to: string; subject: string; text: string }[] = [];
    return {
      outbox,
      async send(message: { to: string; subject: string; text: string }) {
        outbox.push(message);
        if (process.env.NODE_ENV !== "test") console.info(`[e-mail simulé] ${message.to} · ${message.subject}`);
        return { id: `mock_mail_${outbox.length}` };
      },
    };
  })(),
};

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

/** Une lecture OCR n'est validée automatiquement que si chaque champ dépasse le seuil de confiance. */
export function ocrNeedsReview(fields: OcrField[]): boolean {
  return fields.some((f) => f.confidence < CONFIDENCE_THRESHOLD);
}

/** État des intégrations, pour le bloc « Vérifications » de l'administration. */
export function integrationStatus() {
  const has = (k: string) => !!process.env[k];
  return [
    { key: "realtime", label: "Temps réel (Ably)", configured: has("ABLY_API_KEY") },
    { key: "payments", label: "Paiement (Stripe)", configured: has("STRIPE_SECRET_KEY") && has("STRIPE_WEBHOOK_SECRET") },
    { key: "storage", label: "Stockage (Vercel Blob)", configured: has("BLOB_READ_WRITE_TOKEN") },
    { key: "email", label: "E-mails (Resend)", configured: has("RESEND_API_KEY") },
    { key: "ocr", label: "Lecture des captures (OCR)", configured: has("OCR_API_KEY") },
    { key: "cron", label: "Tâches programmées (CRON_SECRET)", configured: has("CRON_SECRET") },
  ];
}

/** Implémentations actives : les adaptateurs réels remplaceront les mocks dès qu'ils seront branchés. */
export const integrations = {
  realtime: mocks.realtime as Realtime,
  ocr: mocks.ocr as Ocr,
  payments: mocks.payments as Payments,
  storage: mocks.storage as Storage,
  email: mocks.email as Email,
};
