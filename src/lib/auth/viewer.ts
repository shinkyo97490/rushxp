import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { db } from "@/lib/db";
import type { Role } from "@/lib/session-shared";
import { auth } from "./auth";
import { effectiveRole } from "./roles";

export interface Viewer {
  id: string;
  pseudo: string;
  email: string;
  role: Role;
  onboarded: boolean;
  structure: { id: string; name: string; tag: string; status: string } | null;
}

/** Utilisateur connecté (null si visiteur). Mis en cache pour la durée d'une requête. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // headers() hors du try : c'est lui qui rend la page dynamique (à ne pas intercepter).
  const h = await headers();
  let session;
  try {
    session = await auth.api.getSession({ headers: h });
  } catch (e) {
    unstable_rethrow(e);
    console.error("Lecture de session impossible", e);
    return null;
  }
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      structureStaff: { include: { structure: true }, orderBy: { createdAt: "asc" } },
      captainOf: { select: { id: true }, take: 1 },
    },
  });
  if (!user || user.status === "SUSPENDED") return null;
  const s = user.structureStaff[0]?.structure;
  return {
    id: user.id,
    pseudo: user.pseudo,
    email: user.email,
    role: effectiveRole({ dbRole: user.role, managesStructure: user.structureStaff.length > 0, captainOfRoster: user.captainOf.length > 0 }),
    onboarded: !!user.onboardedAt,
    structure: s ? { id: s.id, name: s.name, tag: s.tag, status: s.status } : null,
  };
});

export async function requireViewer(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) {
    const { redirect } = await import("next/navigation");
    redirect("/connexion");
  }
  return v!;
}
