import "server-only";
import { db } from "@/lib/db";
import { getGame } from "@/lib/data/games";
import { lanStructurePoints } from "@/lib/rules/scales";

/** Ordre d'affichage : inscriptions ouvertes, annoncés, fermés, puis terminés (du plus récent au plus ancien). */
const ORDER = { OPEN: 0, ANNOUNCED: 1, CLOSED: 2, DONE: 3, DRAFT: 4 } as const;

export async function listLans(includeDrafts = false) {
  const lans = await db.lanEvent.findMany({
    where: includeDrafts ? {} : { status: { not: "DRAFT" } },
    include: { tournaments: { include: { _count: { select: { registrations: { where: { status: { in: ["PENDING", "PAID"] } } } } } } } },
  });
  return lans.sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.startsAt?.getTime() ?? 0) - (a.startsAt?.getTime() ?? 0));
}

export async function getLan(slug: string) {
  return db.lanEvent.findUnique({
    where: { slug },
    include: {
      tournaments: {
        orderBy: { game: "asc" },
        include: {
          registrations: { where: { status: { in: ["PENDING", "PAID"] } }, orderBy: { createdAt: "asc" } },
          results: { orderBy: { place: "asc" } },
        },
      },
    },
  });
}
export type LanFull = NonNullable<Awaited<ReturnType<typeof getLan>>>;

/** Inscriptions actives qui occupent une place (les paiements en attente réservent la place). */
export function seatsTaken(t: LanFull["tournaments"][number]) {
  return t.registrations.length;
}

export function isSoloGame(game: string) {
  return (getGame(game)?.rosterSize ?? 1) === 1;
}

/** Points ajoutés au classement général par une LAN terminée. */
export async function lanPointsFor(lan: LanFull) {
  const ids = [...new Set(lan.tournaments.flatMap((t) => t.results.map((r) => r.structureId)).filter((x): x is string => !!x))];
  const structures = await db.structure.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, tag: true } });
  const byId = new Map(structures.map((s) => [s.id, s]));
  return lanStructurePoints(lan.tournaments.flatMap((t) => t.results.map((r) => ({ game: t.game, place: r.place, structure: r.structureId })))).map((p) => ({
    ...p,
    name: byId.get(p.structure)?.name ?? "Structure",
    tag: byId.get(p.structure)?.tag,
  }));
}

/** Ce que le visiteur connecté peut inscrire : lui-même (solo) ou les équipes qu'il capitaine / gère. */
export async function lanOptionsFor(userId: string) {
  const rosters = await db.roster.findMany({
    where: { OR: [{ captainId: userId }, { structure: { staff: { some: { userId } } } }] },
    include: { structure: { select: { id: true, name: true } }, members: { where: { leftAt: null }, include: { user: { select: { pseudo: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return rosters.map((r) => ({
    id: r.id,
    game: r.game,
    name: r.name,
    structure: r.structure.name,
    starters: r.members.filter((m) => m.role === "STARTER").map((m) => m.user.pseudo),
  }));
}
export type LanOption = Awaited<ReturnType<typeof lanOptionsFor>>[number];

/** Paiement : Stripe si configuré ; sinon paiement simulé, interdit en production. */
export function paymentMode(): "stripe" | "mock" | "off" {
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET) return "stripe";
  return process.env.VERCEL_ENV === "production" ? "off" : "mock";
}

/** Frais de service par inscription (prototype : 1 €). */
export const SERVICE_FEE_CENTS = 100;

export const euros = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

const D = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Indian/Reunion", ...o });

/** « Sam. 21 – dim. 22 nov. 2026 » ou « Date à confirmer ». */
export function lanDates(start: Date | null, end: Date | null) {
  if (!start) return "Date à confirmer";
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const full = D({ weekday: "short", day: "numeric", month: "short", year: "numeric" });
  if (!end || D({ dateStyle: "short" }).format(end) === D({ dateStyle: "short" }).format(start)) return cap(full.format(start));
  return `${cap(D({ weekday: "short", day: "numeric" }).format(start))} – ${full.format(end)}`;
}

export const LAN_STATUS: Record<string, { label: string; tone: "orange" | "yellow" | "muted" | "neutral" }> = {
  DRAFT: { label: "Brouillon", tone: "neutral" },
  ANNOUNCED: { label: "Annoncé · inscriptions bientôt", tone: "yellow" },
  OPEN: { label: "Inscriptions ouvertes", tone: "orange" },
  CLOSED: { label: "Inscriptions fermées", tone: "neutral" },
  DONE: { label: "Terminée · résultats validés", tone: "muted" },
};

export interface ProgramDay {
  day: string;
  items: [string, string][];
}
export function parseProgram(v: unknown): ProgramDay[] {
  return Array.isArray(v) ? (v as ProgramDay[]).filter((d) => d && typeof d.day === "string" && Array.isArray(d.items)) : [];
}

/** Programme en texte éditable : le jour sur une ligne, puis « 09:00 Activité ». */
export function programToText(v: unknown) {
  return parseProgram(v)
    .map((d) => [d.day, ...d.items.map(([t, l]) => `${t} ${l}`)].join("\n"))
    .join("\n\n");
}

/** Compte à rebours (jours, heures, minutes) jusqu'au début ; null si l'événement a commencé. */
export function countdownTo(start: Date): [string, number][] | null {
  const left = start.getTime() - Date.now();
  if (left <= 0) return null;
  return [["jours", Math.floor(left / 864e5)], ["heures", Math.floor((left % 864e5) / 36e5)], ["min", Math.floor((left % 36e5) / 6e4)]];
}
