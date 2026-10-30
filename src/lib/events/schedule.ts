/** Dates des rendez-vous mensuels : un samedi par mois et par jeu, pendant les phases qui autorisent les RDV (pré-saison et saison régulière par défaut). */

import { defaultSeason, monthlyEventsAllowed } from "@/lib/rules/season";

const RULE: Record<"tft" | "wz" | "apex", { nth: number | "last"; hour: number; minute: number }> = {
  tft: { nth: 3, hour: 18, minute: 0 },
  wz: { nth: 4, hour: 20, minute: 0 },
  apex: { nth: "last", hour: 20, minute: 0 },
};

/** Par défaut : calendrier de saison validé. En production, la page passe les phases lues en base. */
const defaultAllowed = (d: Date) => monthlyEventsAllowed(defaultSeason(d.getFullYear()).phases, d);

function saturdayOf(year: number, month: number, nth: number | "last") {
  const sats: number[] = [];
  for (let d = 1; d <= 31; d++) {
    const dt = new Date(year, month, d);
    if (dt.getMonth() !== month) break;
    if (dt.getDay() === 6) sats.push(d);
  }
  return nth === "last" ? sats[sats.length - 1] : sats[Math.min(nth, sats.length) - 1];
}

/** Prochain RDV à venir pour ce jeu (à partir de `from`). */
export function nextEventDate(game: "tft" | "wz" | "apex", from: Date, allowed: (d: Date) => boolean = defaultAllowed): Date {
  const r = RULE[game];
  for (let i = 0; i < 24; i++) {
    const y = from.getFullYear() + Math.floor((from.getMonth() + i) / 12);
    const m = (from.getMonth() + i) % 12;
    // Heure locale de La Réunion (UTC+4), quel que soit le fuseau du serveur.
    const day = saturdayOf(y, m, r.nth);
    const d = new Date(`${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(r.hour).padStart(2, "0")}:${String(r.minute).padStart(2, "0")}:00+04:00`);
    if (!allowed(d)) continue;
    if (d > from) return d;
  }
  throw new Error("Aucune date de RDV trouvée");
}

export function monthKey(d: Date) {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion", year: "numeric", month: "2-digit" }).format(d).split("-");
  return `${y}-${m}`;
}
