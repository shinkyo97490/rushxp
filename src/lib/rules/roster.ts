/** Règles de roster et de mercato (SPEC_METIER §6). Fonctions pures. */

export const MAX_SUBS = 2;

/** Mercato : transferts entre structures en juin uniquement. Les agents libres signent toute l'année. */
export function isMercatoOpen(d: Date): boolean {
  return d.getMonth() === 5;
}

export interface RosterCount {
  rosterSize: number; // titulaires requis par le format
  starters: number;
  subs: number;
}

export function rosterSlotError(c: RosterCount, role: "STARTER" | "SUB"): string | null {
  if (role === "STARTER" && c.starters >= c.rosterSize) return `Roster complet : ${c.rosterSize} titulaire(s) maximum.`;
  if (role === "SUB" && c.subs >= MAX_SUBS) return `${MAX_SUBS} remplaçants maximum par roster.`;
  return null;
}

/** Un roster incomplet ne peut ni lancer ni accepter de défi. */
export function isRosterComplete(c: Pick<RosterCount, "rosterSize" | "starters">): boolean {
  return c.starters >= c.rosterSize;
}

/** Peut-on rejoindre une nouvelle structure ? Libre : oui. Sous contrat : seulement pendant le mercato (transfert). */
export function joinBlock(currentStructureId: string | null, targetStructureId: string, now: Date): string | null {
  if (!currentStructureId || currentStructureId === targetStructureId) return null;
  if (!isMercatoOpen(now)) return "Vous êtes sous contrat avec une autre structure : un transfert n’est possible que pendant le mercato (juin).";
  return "Transfert : il faut l’accord des deux structures et la validation RushXP. Faites une demande de transfert.";
}
