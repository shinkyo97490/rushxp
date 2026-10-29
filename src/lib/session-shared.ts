/** Rôles et droits, partagés client / serveur. */

export const ROLES = ["visiteur", "joueur", "capitaine", "gestionnaire", "arbitre", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  visiteur: "Visiteur",
  joueur: "Joueur",
  capitaine: "Capitaine",
  gestionnaire: "Gestionnaire de structure",
  arbitre: "Arbitre",
  admin: "Administrateur",
};

export const ROLE_COOKIE = "rxp-role";

/** Peut lancer / accepter un défi : capitaine ou gestionnaire en équipe, joueur ou capitaine en 1v1. */
export function canChallenge(role: Role, solo: boolean): boolean {
  return solo ? role === "joueur" || role === "capitaine" : role === "capitaine" || role === "gestionnaire";
}

export function isStaff(role: Role) {
  return role === "arbitre" || role === "admin";
}
