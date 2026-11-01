import "server-only";
import { db } from "@/lib/db";
import { ensureNextEvent } from "@/lib/events/queries";
import { dailyRankings } from "@/lib/rankings/engine";

/**
 * Tâches connues. Chaque traitement est idempotent : relancé après un échec, il ne fait rien deux fois.
 * Les échéances des défis sont aussi réglées à chaque visite des Rankings (le cron Hobby ne passe qu'une fois par jour).
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
  /** Défis : relances, expirations, validations automatiques, appariements de placement, inactivité. */
  "rankings.daily": async () => {
    await dailyRankings();
  },
};
