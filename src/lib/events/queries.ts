import "server-only";
import { db } from "@/lib/db";
import { EVENT_FORMATS } from "@/lib/data/content";
import { monthKey, nextEventDate } from "./schedule";
import { getSeason } from "@/lib/season";
import { monthlyEventsAllowed } from "@/lib/rules/season";

type LobbyGame = "tft" | "wz" | "apex";

/** Crée au besoin le prochain RDV du jeu (idempotent). */
export async function ensureNextEvent(game: LobbyGame) {
  const now = new Date();
  // Phases lues en base (année en cours et suivante) : les RDV n'ont lieu que pendant les phases qui l'autorisent.
  const phases = [...(await getSeason(now.getFullYear())).phases, ...(await getSeason(now.getFullYear() + 1)).phases];
  const date = nextEventDate(game, now, (d) => monthlyEventsAllowed(phases, d));
  const f = EVENT_FORMATS[game];
  // Check-in le même jour, à l'heure de La Réunion (le serveur peut tourner en UTC).
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion" }).format(date);
  const checkInAt = new Date(`${day}T${f.checkIn}:00+04:00`);
  return db.monthlyEvent.upsert({
    where: { game_month: { game, month: monthKey(date) } },
    create: { game, month: monthKey(date), date, checkInAt, capacity: f.cap, status: "OPEN" },
    update: {},
  });
}

