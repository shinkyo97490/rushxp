import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { nextRetry } from "@/lib/rules/jobs";
import { HANDLERS } from "./handlers";

/** Programme une tâche. Avec `dedupeKey`, une même tâche n'est jamais programmée deux fois. */
export async function enqueue(kind: string, runAt: Date, payload: Prisma.InputJsonValue = {}, dedupeKey?: string) {
  if (dedupeKey) {
    return db.job.upsert({ where: { dedupeKey }, create: { kind, runAt, payload, dedupeKey }, update: {} });
  }
  return db.job.create({ data: { kind, runAt, payload } });
}

/**
 * Traite les tâches arrivées à échéance. Les tâches sont réservées avec `FOR UPDATE SKIP LOCKED` :
 * deux exécutions simultanées du cron ne traitent jamais la même tâche.
 */
export async function runDueJobs(limit = 25, now = new Date()) {
  const claimed = await db.$queryRaw<{ id: string; kind: string; payload: unknown; attempts: number }[]>`
    UPDATE "Job" SET status = 'RUNNING', attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM "Job" WHERE status = 'PENDING' AND "runAt" <= ${now}
      ORDER BY "runAt" ASC LIMIT ${limit} FOR UPDATE SKIP LOCKED
    )
    RETURNING id, kind, payload, attempts`;
  const report = { done: 0, retried: 0, failed: 0 };
  for (const job of claimed) {
    const handler = HANDLERS[job.kind];
    try {
      if (!handler) throw new Error(`Type de tâche inconnu : ${job.kind}`);
      await handler(job.payload as Record<string, unknown>);
      await db.job.update({ where: { id: job.id }, data: { status: "DONE", finishedAt: new Date(), lastError: null } });
      report.done++;
    } catch (e) {
      const retryAt = nextRetry(job.attempts, new Date());
      const lastError = e instanceof Error ? e.message.slice(0, 500) : String(e);
      await db.job.update({
        where: { id: job.id },
        data: retryAt ? { status: "PENDING", runAt: retryAt, lastError } : { status: "FAILED", finishedAt: new Date(), lastError },
      });
      if (retryAt) report.retried++;
      else report.failed++;
      console.error(`Tâche ${job.kind} (${job.id}) en échec`, e);
    }
  }
  return { claimed: claimed.length, ...report };
}
