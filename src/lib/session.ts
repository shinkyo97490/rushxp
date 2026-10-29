import { cookies } from "next/headers";
import { ROLES, ROLE_COOKIE, type Role } from "./session-shared";

export * from "./session-shared";

/**
 * Session de DÉMONSTRATION : le rôle vient d'un cookie posé par le sélecteur « Voir en tant que ».
 * À remplacer par une vraie authentification. Les droits devront être contrôlés côté serveur
 * à partir de la session authentifiée, jamais à partir de ce cookie.
 */
export async function getRole(): Promise<Role> {
  const v = (await cookies()).get(ROLE_COOKIE)?.value;
  return (ROLES as readonly string[]).includes(v ?? "") ? (v as Role) : "capitaine";
}
