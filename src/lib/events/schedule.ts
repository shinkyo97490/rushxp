/** Dates des rendez-vous mensuels : un samedi par mois et par jeu, pas de RDV en juin (mercato) ni en décembre–février. */

const RULE: Record<"tft" | "wz" | "apex", { nth: number | "last"; hour: number; minute: number }> = {
  tft: { nth: 3, hour: 18, minute: 0 },
  wz: { nth: 4, hour: 20, minute: 0 },
  apex: { nth: "last", hour: 20, minute: 0 },
};

const ACTIVE_MONTHS = [2, 3, 4, 6, 7, 8, 9, 10]; // mars → mai, juillet → novembre (0 = janvier)

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
export function nextEventDate(game: "tft" | "wz" | "apex", from: Date): Date {
  const r = RULE[game];
  for (let i = 0; i < 24; i++) {
    const y = from.getFullYear() + Math.floor((from.getMonth() + i) / 12);
    const m = (from.getMonth() + i) % 12;
    if (!ACTIVE_MONTHS.includes(m)) continue;
    const d = new Date(y, m, saturdayOf(y, m, r.nth), r.hour, r.minute);
    if (d > from) return d;
  }
  throw new Error("Aucune date de RDV trouvée");
}

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
