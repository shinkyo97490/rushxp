import { enqueue, runDueJobs } from "@/lib/jobs/queue";

/**
 * Déclencheur des tâches programmées. Appelé par Vercel Cron (en-tête `Authorization: Bearer $CRON_SECRET`)
 * ou par un service externe pour un passage plus fréquent que l'offre Vercel ne le permet.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET non configuré", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Non autorisé", { status: 401 });

  // Tâches récurrentes du jour (dédoublonnées par date).
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion" }).format(new Date());
  await enqueue("maintenance.daily", new Date(), {}, `maintenance.daily:${day}`);
  await enqueue("events.ensure-next", new Date(), {}, `events.ensure-next:${day}`);

  const report = await runDueJobs();
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
