/**
 * Calendrier de saison (décision du 30 oct. 2026) :
 * pré-saison janv. → avr., saison régulière mai → août, Playoffs sept. → déc.
 * Seeding figé le 31 août à 23:59 (heure de La Réunion). Pas de mercato.
 * Les phases sont stockées en base (Season, SeasonPhase) ; ces fonctions sont pures et testées.
 */

export type PhaseKind = "PRESEASON" | "REGULAR" | "PLAYOFFS" | "BREAK";

export interface SeasonPhaseDef {
  kind: PhaseKind;
  label: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  countsForGeneral: boolean;
  monthlyEvents: boolean;
}

export interface SeasonDef {
  year: number;
  name: string;
  seedingAt: Date;
  phases: SeasonPhaseDef[];
}

/** La Réunion : UTC+4, sans heure d'été. */
export const TIME_ZONE = "Indian/Reunion";
const TZ_OFFSET = "+04:00";

const at = (year: number, month: number, day: number, time = "00:00:00") =>
  new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${time}${TZ_OFFSET}`);
const endOfMonth = (year: number, month: number) => new Date(at(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1, 1).getTime() - 1);

/** Saison par défaut d'une année (utilisée pour le seed et en secours si la base est vide). */
export function defaultSeason(year: number): SeasonDef {
  return {
    year,
    name: `Saison ${year}`,
    seedingAt: at(year, 8, 31, "23:59:00"),
    phases: [
      {
        kind: "PRESEASON",
        label: "Pré-saison",
        description: "5 matchs de placement, score provisoire 800. Les matchs classent mais ne comptent pas au classement général.",
        startsAt: at(year, 1, 1),
        endsAt: endOfMonth(year, 4),
        countsForGeneral: false,
        monthlyEvents: true,
      },
      {
        kind: "REGULAR",
        label: "Saison régulière",
        description: "Défis classés, divisions de 8. Le seeding est figé le 31 août à 23:59 : le top 8 de la Division 1 va en Playoffs.",
        startsAt: at(year, 5, 1),
        endsAt: endOfMonth(year, 8),
        countsForGeneral: true,
        monthlyEvents: true,
      },
      {
        kind: "PLAYOFFS",
        label: "Playoffs",
        description: "Top 8 de la Division 1, élimination directe. 2 500 € de cashprize.",
        startsAt: at(year, 9, 1),
        endsAt: endOfMonth(year, 12),
        countsForGeneral: true,
        monthlyEvents: false,
      },
    ],
  };
}

export function phaseAt<P extends Pick<SeasonPhaseDef, "startsAt" | "endsAt">>(phases: P[], d: Date): P | null {
  return phases.find((p) => d >= p.startsAt && d <= p.endsAt) ?? null;
}

export function phaseState(p: Pick<SeasonPhaseDef, "startsAt" | "endsAt">, d: Date): "done" | "current" | "upcoming" {
  return d > p.endsAt ? "done" : d >= p.startsAt ? "current" : "upcoming";
}

/** Prochaine phase qui commence après `d`. */
export function nextPhase<P extends Pick<SeasonPhaseDef, "startsAt">>(phases: P[], d: Date): P | null {
  return [...phases].sort((a, b) => +a.startsAt - +b.startsAt).find((p) => p.startsAt > d) ?? null;
}

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: TIME_ZONE });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « Janv. → avr. » */
export function phaseWhen(p: Pick<SeasonPhaseDef, "startsAt" | "endsAt">): string {
  const a = MONTH.format(p.startsAt);
  const b = MONTH.format(p.endsAt);
  return a === b ? cap(a) : `${cap(a)} → ${b}`;
}

/** Les RDV mensuels ont lieu pendant les phases qui l'autorisent. */
export function monthlyEventsAllowed(phases: Pick<SeasonPhaseDef, "startsAt" | "endsAt" | "monthlyEvents">[], d: Date): boolean {
  return !!phaseAt(phases, d)?.monthlyEvents;
}
