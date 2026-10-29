import "server-only";
import { db } from "@/lib/db";
import { EVENT_FORMATS } from "@/lib/data/content";
import { monthKey, nextEventDate } from "./schedule";

type LobbyGame = "tft" | "wz" | "apex";

/** Crée au besoin le prochain RDV du jeu (idempotent). */
export async function ensureNextEvent(game: LobbyGame) {
  const date = nextEventDate(game, new Date());
  const f = EVENT_FORMATS[game];
  const [h, mi] = f.checkIn.split(":").map(Number);
  const checkInAt = new Date(date);
  checkInAt.setHours(h, mi, 0, 0);
  return db.monthlyEvent.upsert({
    where: { game_month: { game, month: monthKey(date) } },
    create: { game, month: monthKey(date), date, checkInAt, capacity: f.cap, status: "OPEN" },
    update: {},
  });
}

