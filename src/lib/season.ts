import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { defaultSeason, nextPhase, phaseAt, type SeasonDef, type SeasonPhaseDef } from "@/lib/rules/season";

export { phaseState, phaseWhen } from "@/lib/rules/season";
export type { SeasonPhaseDef } from "@/lib/rules/season";

/**
 * Saison de l'année (lue en base, paramétrable par l'admin). Si elle n'existe pas encore,
 * on renvoie le calendrier par défaut pour que le site reste cohérent.
 */
export const getSeason = cache(async (year: number): Promise<SeasonDef> => {
  try {
    const s = await db.season.findUnique({ where: { year }, include: { phases: { orderBy: { startsAt: "asc" } } } });
    if (s && s.phases.length) {
      return {
        year: s.year,
        name: s.name,
        seedingAt: s.seedingAt,
        phases: s.phases.map((p) => ({
          kind: p.kind,
          label: p.label,
          description: p.description ?? "",
          startsAt: p.startsAt,
          endsAt: p.endsAt,
          countsForGeneral: p.countsForGeneral,
          monthlyEvents: p.monthlyEvents,
        })),
      };
    }
  } catch (e) {
    console.error("Lecture de la saison impossible, calendrier par défaut utilisé", e);
  }
  return defaultSeason(year);
});

/** Saison en cours, phase en cours et prochaine étape (au besoin dans la saison suivante). */
export async function getSeasonContext(now = new Date()) {
  const season = await getSeason(now.getFullYear());
  const following = await getSeason(now.getFullYear() + 1);
  const phase: SeasonPhaseDef | null = phaseAt(season.phases, now);
  const next = nextPhase(season.phases, now) ?? following.phases[0] ?? null;
  return { season, phase, next };
}
