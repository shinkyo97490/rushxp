import "server-only";
import { getViewer } from "@/lib/auth/viewer";
import type { Role } from "./session-shared";

export * from "./session-shared";

/** Rôle effectif de la requête courante, toujours calculé côté serveur. */
export async function getRole(): Promise<Role> {
  return (await getViewer())?.role ?? "visiteur";
}
