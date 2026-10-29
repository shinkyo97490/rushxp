import type { Role } from "@/lib/session-shared";

export interface RoleFacts {
  dbRole: "JOUEUR" | "CAPITAINE" | "GESTIONNAIRE" | "ARBITRE" | "ADMIN";
  managesStructure: boolean;
  captainOfRoster: boolean;
}

/**
 * Rôle effectif, calculé côté serveur à chaque requête :
 * ADMIN et ARBITRE sont attribués par RushXP ; gestionnaire et capitaine se déduisent
 * des structures et des rosters ; sinon joueur.
 */
export function effectiveRole(f: RoleFacts): Role {
  if (f.dbRole === "ADMIN") return "admin";
  if (f.dbRole === "ARBITRE") return "arbitre";
  if (f.managesStructure) return "gestionnaire";
  if (f.captainOfRoster) return "capitaine";
  return "joueur";
}
