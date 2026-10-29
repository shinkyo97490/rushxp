/** Calendrier de saison (SPEC_METIER §3). Mois 1-12, bornes incluses. */

export interface Phase {
  key: "placement" | "split1" | "mercato" | "split2" | "playoffs" | "intersaison";
  label: string;
  months: [number, number];
  when: string;
  text: string;
}

export const PHASES: Phase[] = [
  { key: "placement", label: "Placement", months: [1, 2], when: "Janv. → févr.", text: "5 matchs de placement, score provisoire 800. Première répartition en divisions fin février." },
  { key: "split1", label: "Split 1 · Défis classés", months: [3, 5], when: "Mars → mai", text: "Divisions de 8, défis et matchs de classement. Montées et descentes le 31 mai." },
  { key: "mercato", label: "Mercato", months: [6, 6], when: "Juin", text: "Transferts entre structures, avec accord des deux structures, du joueur et validation RushXP." },
  { key: "split2", label: "Split 2 · Défis classés", months: [7, 9], when: "Juil. → sept.", text: "Le seeding officiel est figé le 30 septembre à 23:59 (horodatage + hash)." },
  { key: "playoffs", label: "Playoffs", months: [10, 11], when: "Oct. → nov.", text: "Top 8 de la Division 1, élimination directe. 2 500 € de cashprize." },
];

export function currentPhase(d: Date): Phase | null {
  const m = d.getMonth() + 1;
  return PHASES.find((p) => m >= p.months[0] && m <= p.months[1]) ?? null;
}

export function phaseState(p: Phase, d: Date): "done" | "current" | "upcoming" {
  const m = d.getMonth() + 1;
  return m > p.months[1] ? "done" : m >= p.months[0] ? "current" : "upcoming";
}
