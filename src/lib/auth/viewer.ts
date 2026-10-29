import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { db } from "@/lib/db";
import type { Role } from "@/lib/session-shared";
import { auth } from "./auth";
import { effectiveRole } from "./roles";
import { resolvePrefs } from "@/lib/account/preferences";

export interface Viewer {
  id: string;
  pseudo: string;
  email: string;
  role: Role;
  onboarded: boolean;
  /** Structure gérée (gestionnaire). */
  structure: { id: string; name: string; tag: string; status: string } | null;
  /** Structure sous contrat (joueur), ou gérée à défaut. */
  club: { id: string; name: string; tag: string } | null;
  unreadNotifications: number;
  unreadMessages: number;
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
      contracts: { where: { leftAt: null }, include: { structure: { select: { id: true, name: true, tag: true } } }, take: 1 },
      notifications: { where: { readAt: null }, select: { category: true }, take: 200 },
    },
  });
  if (!user || user.status === "SUSPENDED") return null;
  // Conversations dont le dernier message vient de l'autre membre et n'a pas été lu.
  const threads = await db.thread.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    select: { userAId: true, readA: true, readB: true, messages: { orderBy: { createdAt: "desc" }, take: 1, select: { authorId: true, createdAt: true } } },
    take: 100,
  });
  const unreadMessages = threads.filter((t) => {
    const last = t.messages[0];
    const read = t.userAId === user.id ? t.readA : t.readB;
    return !!last && last.authorId !== user.id && (!read || read < last.createdAt);
  }).length;
  const s = user.structureStaff[0]?.structure;
  return {
    id: user.id,
    pseudo: user.pseudo,
    email: user.email,
    role: effectiveRole({ dbRole: user.role, managesStructure: user.structureStaff.length > 0, captainOfRoster: user.captainOf.length > 0 }),
    onboarded: !!user.onboardedAt,
    structure: s ? { id: s.id, name: s.name, tag: s.tag, status: s.status } : null,
    club: user.contracts[0]?.structure ?? (s ? { id: s.id, name: s.name, tag: s.tag } : null),
    unreadMessages,
    unreadNotifications: user.notifications.filter((n) => resolvePrefs(user.notifPrefs)[n.category]?.site ?? true).length,
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
