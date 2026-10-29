import "server-only";
import { db } from "@/lib/db";

const memberSelect = { id: true, pseudo: true } as const;

/** Structure complète pour la page Équipe : rosters, effectif, invitations et demandes. */
export async function getTeamStructure(structureId: string) {
  return db.structure.findUnique({
    where: { id: structureId },
    include: {
      staff: { include: { user: { select: memberSelect } } },
      rosters: {
        orderBy: [{ game: "asc" }, { createdAt: "asc" }],
        include: {
          gameRef: { select: { name: true, rosterSize: true } },
          members: { where: { leftAt: null }, include: { user: { select: memberSelect } }, orderBy: [{ role: "asc" }, { joinedAt: "asc" }] },
        },
      },
      members: { where: { leftAt: null }, include: { user: { select: memberSelect } }, orderBy: { joinedAt: "asc" } },
      invitations: {
        where: { status: "PENDING" },
        include: { user: { select: memberSelect }, roster: { select: { name: true, game: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export type TeamStructure = NonNullable<Awaited<ReturnType<typeof getTeamStructure>>>;

export async function getMyInvitations(userId: string) {
  return db.invitation.findMany({
    where: { userId, status: "PENDING", kind: "INVITE" },
    include: { structure: { select: { name: true, tag: true } }, roster: { select: { name: true, game: true } }, invitedBy: { select: { pseudo: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMyRequests(userId: string) {
  return db.invitation.findMany({
    where: { userId, status: "PENDING", kind: "REQUEST" },
    include: { structure: { select: { name: true, tag: true } } },
  });
}

export async function getAds(game?: string) {
  return db.recruitAd.findMany({
    where: { moderation: "APPROVED", expiresAt: { gt: new Date() }, ...(game ? { game } : {}) },
    include: { author: { select: memberSelect }, structure: { select: { name: true, tag: true } } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
}

export async function getMyAds(userId: string) {
  return db.recruitAd.findMany({ where: { authorId: userId }, orderBy: { createdAt: "desc" } });
}

export async function getTransfers() {
  return db.transfer.findMany({
    where: { status: "APPROVED" },
    include: { user: { select: memberSelect }, fromStructure: { select: { name: true } }, toStructure: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
