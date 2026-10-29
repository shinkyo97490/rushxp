/**
 * Éligibilité aux défis (SPEC_METIER §6, Centre des défis du prototype).
 * Fonction pure : le serveur l'appelle avant toute création de défi, l'UI pour afficher la raison.
 */

export const MAX_PENDING_OUT = 2;
export const REMATCH_DAYS = 14;
export const PAIR_WINDOW_DAYS = 30;
export const PAIR_MAX_COUNTED = 2;
export const UNJUSTIFIED_REFUSAL_PENALTY = 40;
export const RESPONSE_HOURS = 48;

export interface Contender {
  id: string;
  rank: number;
  structureId: string | null; // null en 1v1 sans structure
  inPlacement: boolean;
  inactive: boolean;
  immuneUntil?: Date | null;
  rosterComplete: boolean;
}

export interface ChallengeContext {
  me: Contender;
  all: Contender[];
  canAct: boolean; // rôle autorisé (capitaine / gestionnaire, ou joueur en 1v1)
  pendingOut: number;
  busyWith: Set<string>; // adversaires avec un défi actif
  lastMatchWith: Map<string, Date>;
  now: Date;
}

export type Ineligibility =
  | "self"
  | "role"
  | "roster_incomplete"
  | "same_structure"
  | "quota"
  | "busy"
  | "rematch"
  | "immune"
  | "placement"
  | "inactive"
  | "out_of_zone";

export const INELIGIBILITY_LABEL: Record<Ineligibility, string> = {
  self: "C’est votre profil.",
  role: "Seul le capitaine ou le gestionnaire peut lancer un défi.",
  roster_incomplete: "Roster incomplet : impossible de lancer ou d’accepter un défi.",
  same_structure: "Équipe de votre structure : pas de défi interne.",
  quota: `Limite atteinte : ${MAX_PENDING_OUT} défis en attente maximum.`,
  busy: "Un défi est déjà en cours avec cet adversaire.",
  rematch: `Revanche impossible avant ${REMATCH_DAYS} jours.`,
  immune: "Immunité de 72 h après une défense réussie.",
  placement: "Participant en placement : appariement par le système.",
  inactive: "Participant inactif.",
  out_of_zone: "Hors zone : 2 rangs au-dessus et 1 rang en dessous.",
};

export function ineligibilityLabel(reason: Ineligibility, widened: boolean): string {
  if (reason === "out_of_zone" && widened) return "Hors zone élargie : 3 rangs au-dessus, 2 en dessous.";
  return INELIGIBILITY_LABEL[reason];
}

const DAY = 86_400_000;

function standardZone(me: number, other: number) {
  return other >= me - 2 && other <= me + 1;
}
function widenedZone(me: number, other: number) {
  return other >= me - 3 && other <= me + 2;
}

/** Raisons « adversaire » indépendantes de la zone. */
function opponentBlock(ctx: ChallengeContext, o: Contender): Ineligibility | null {
  if (ctx.busyWith.has(o.id)) return "busy";
  const last = ctx.lastMatchWith.get(o.id);
  if (last && ctx.now.getTime() - last.getTime() < REMATCH_DAYS * DAY) return "rematch";
  if (o.immuneUntil && o.immuneUntil > ctx.now) return "immune";
  if (o.inPlacement) return "placement";
  if (o.inactive) return "inactive";
  if (!o.rosterComplete) return "roster_incomplete";
  return null;
}

function sameStructure(me: Contender, o: Contender) {
  return me.structureId !== null && me.structureId === o.structureId;
}

/** La zone s'élargit à 3 au-dessus / 2 en dessous si moins de 2 adversaires sont disponibles. */
export function isZoneWidened(ctx: ChallengeContext): boolean {
  const available = ctx.all.filter(
    (o) => o.id !== ctx.me.id && standardZone(ctx.me.rank, o.rank) && !sameStructure(ctx.me, o) && !opponentBlock(ctx, o),
  );
  return available.length < 2;
}

export function challengeBlock(ctx: ChallengeContext, o: Contender): Ineligibility | null {
  if (o.id === ctx.me.id) return "self";
  if (sameStructure(ctx.me, o)) return "same_structure";
  if (!ctx.canAct) return "role";
  if (!ctx.me.rosterComplete) return "roster_incomplete";
  const block = opponentBlock(ctx, o);
  if (block) return block;
  const inZone = isZoneWidened(ctx) ? widenedZone : standardZone;
  if (!inZone(ctx.me.rank, o.rank)) return "out_of_zone";
  if (ctx.pendingOut >= MAX_PENDING_OUT) return "quota";
  return null;
}

/** Un match ne compte au classement que si la paire n'a pas déjà 2 matchs comptés sur 30 jours glissants. */
export function countsForRanking(countedPairDates: Date[], now: Date): boolean {
  const recent = countedPairDates.filter((d) => now.getTime() - d.getTime() < PAIR_WINDOW_DAYS * DAY);
  return recent.length < PAIR_MAX_COUNTED;
}

/** Cycle de vie : transitions autorisées. Le serveur refuse toute autre transition. */
export const CHALLENGE_TRANSITIONS = {
  PENDING: ["ACCEPTED", "PLANNED", "REFUSED", "EXPIRED", "CANCELLED", "FORFEIT"],
  ACCEPTED: ["PLANNED", "CANCELLED"],
  PLANNED: ["CHECK_IN", "CANCELLED", "FORFEIT"],
  CHECK_IN: ["LIVE", "FORFEIT"],
  LIVE: ["SUBMITTED"],
  SUBMITTED: ["DONE", "DISPUTED"],
  DISPUTED: ["DONE"],
  DONE: [],
  REFUSED: [],
  EXPIRED: [],
  CANCELLED: [],
  FORFEIT: [],
} as const;

export type ChallengeStatus = keyof typeof CHALLENGE_TRANSITIONS;

export function canTransition(from: ChallengeStatus, to: ChallengeStatus): boolean {
  return (CHALLENGE_TRANSITIONS[from] as readonly string[]).includes(to);
}
