/**
 * Règles de roster et de transfert. Fonctions pures.
 * Pas de mercato (décision du 30 oct. 2026) : circuit amateur, transferts possibles toute l’année.
 */

export const MAX_SUBS = 2;

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

/**
 * Nature d'une arrivée dans une structure :
 * SIGNING = agent libre ; TRANSFER = quitte automatiquement sa structure actuelle ; SAME = déjà sous contrat ici.
 */
export function transferKind(currentStructureId: string | null, targetStructureId: string): "SIGNING" | "TRANSFER" | "SAME" {
  if (!currentStructureId) return "SIGNING";
  return currentStructureId === targetStructureId ? "SAME" : "TRANSFER";
}
