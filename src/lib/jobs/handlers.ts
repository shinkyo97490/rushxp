import "server-only";
import { db } from "@/lib/db";
import { ensureNextEvent } from "@/lib/events/queries";

/**
 * Tâches connues. Chaque traitement est idempotent : relancé après un échec, il ne fait rien deux fois.
 * Les lots suivants ajoutent : relances et expirations de défis, forfaits au check-in, activation des cycles de cartes,
 * publications programmées, analyse OCR, recalcul des classements.
 */
export const HANDLERS: Record<string, (payload: Record<string, unknown>) => Promise<void>> = {
  /** Entretien quotidien : sessions et jetons expirés. */
  "maintenance.daily": async () => {
    const now = new Date();
    await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
    await db.verification.deleteMany({ where: { expiresAt: { lt: now } } });
    await db.job.deleteMany({ where: { status: "DONE", finishedAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } } });
  },
  /** Prépare les prochains RDV mensuels (inscriptions ouvertes à l'avance). */
  "events.ensure-next": async () => {
    for (const game of ["tft", "wz", "apex"] as const) await ensureNextEvent(game);
  },
};
