-- CreateEnum
CREATE TYPE "Role" AS ENUM ('JOUEUR', 'CAPITAINE', 'GESTIONNAIRE', 'ARBITRE', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "GameKind" AS ENUM ('CHALLENGE', 'LOBBY');

-- CreateEnum
CREATE TYPE "AccountProvider" AS ENUM ('RIOT', 'ACTIVISION', 'EA', 'EPIC', 'BANDAI', 'STEAM');

-- CreateEnum
CREATE TYPE "StructureStatus" AS ENUM ('DRAFT', 'PENDING', 'VERIFIED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('STARTER', 'SUB');

-- CreateEnum
CREATE TYPE "TransferKind" AS ENUM ('SIGNING', 'TRANSFER', 'RELEASE');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING_CLUBS', 'PENDING_PLAYER', 'PENDING_RUSHXP', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecruitAdKind" AS ENUM ('STRUCTURE', 'PLAYER');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PLANNED', 'CHECK_IN', 'LIVE', 'SUBMITTED', 'DONE', 'REFUSED', 'EXPIRED', 'DISPUTED', 'CANCELLED', 'FORFEIT');

-- CreateEnum
CREATE TYPE "ChallengeOrigin" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('CHALLENGE', 'PLAYOFF');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'CHECK_IN', 'LIVE', 'SUBMITTED', 'DONE', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('UPLOADED', 'ANALYZING', 'EXTRACTED', 'AWAITING_OPPONENT', 'AUTO_VALIDATED', 'REFEREE_REVIEW', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'OPEN', 'CHECK_IN', 'LIVE', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('PENDING', 'ENTRY', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ResultSource" AS ENUM ('OCR', 'MANUAL');

-- CreateEnum
CREATE TYPE "SanctionTarget" AS ENUM ('USER', 'ROSTER', 'STRUCTURE');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('OWNER', 'MANAGER');

-- CreateEnum
CREATE TYPE "InvitationKind" AS ENUM ('INVITE', 'REQUEST');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "pseudo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'JOUEUR',
    "region" TEXT NOT NULL DEFAULT 'RE',
    "intent" TEXT,
    "availability" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "twoFA" BOOLEAN NOT NULL DEFAULT false,
    "termsAcceptedAt" TIMESTAMP(3),
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameAccount" (
    "userId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "provider" "AccountProvider" NOT NULL,
    "externalId" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "GameAccount_pkey" PRIMARY KEY ("userId","game")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "GameKind" NOT NULL,
    "rosterSize" INTEGER NOT NULL,
    "series" TEXT,
    "lobbySize" INTEGER,
    "scale" JSONB,
    "killPoint" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Structure" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'RE',
    "bio" TEXT,
    "logoUrl" TEXT,
    "inviteCode" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "status" "StructureStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureStaff" (
    "structureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'MANAGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StructureStaff_pkey" PRIMARY KEY ("structureId","userId")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "kind" "InvitationKind" NOT NULL DEFAULT 'INVITE',
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Roster" (
    "id" TEXT NOT NULL,
    "structureId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "captainId" TEXT,

    CONSTRAINT "Roster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterMember" (
    "rosterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'STARTER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "RosterMember_pkey" PRIMARY KEY ("rosterId","userId","joinedAt")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromStructureId" TEXT,
    "toStructureId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "kind" "TransferKind" NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING_CLUBS',
    "window" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitAd" (
    "id" TEXT NOT NULL,
    "kind" "RecruitAdKind" NOT NULL,
    "authorId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "role" TEXT,
    "level" TEXT,
    "availability" TEXT,
    "text" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "moderation" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingEntry" (
    "game" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 800,
    "k" INTEGER NOT NULL DEFAULT 40,
    "placementMatches" INTEGER NOT NULL DEFAULT 0,
    "division" INTEGER,
    "lastMatchAt" TIMESTAMP(3),
    "immunityUntil" TIMESTAMP(3),
    "onLeaveUntil" TIMESTAMP(3),

    CONSTRAINT "RankingEntry_pkey" PRIMARY KEY ("game","entityId")
);

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "defenderId" TEXT NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "proposedSlots" TIMESTAMP(3)[],
    "slot" TIMESTAMP(3),
    "stakesWin" INTEGER NOT NULL,
    "stakesLoss" INTEGER NOT NULL,
    "origin" "ChallengeOrigin" NOT NULL DEFAULT 'MANUAL',
    "refusalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondBy" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "type" "MatchType" NOT NULL,
    "challengeId" TEXT,
    "a" TEXT NOT NULL,
    "b" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "checkInA" TIMESTAMP(3),
    "checkInB" TIMESTAMP(3),
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "streamLinks" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Veto" (
    "matchId" TEXT NOT NULL,
    "steps" JSONB NOT NULL,

    CONSTRAINT "Veto_pkey" PRIMARY KEY ("matchId")
);

-- CreateTable
CREATE TABLE "ResultSubmission" (
    "id" TEXT NOT NULL,
    "matchId" TEXT,
    "eventRoundId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "ocrValues" JSONB,
    "ocrConfidence" DOUBLE PRECISION,
    "declaredA" INTEGER,
    "declaredB" INTEGER,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "decision" TEXT,
    "refereeId" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sanction" (
    "id" TEXT NOT NULL,
    "targetType" "SanctionTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "article" TEXT,
    "until" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sanction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyEvent" (
    "id" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "MonthlyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventEntry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "members" TEXT[],

    CONSTRAINT "EventEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRound" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "lobbies" JSONB NOT NULL,
    "status" "RoundStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "EventRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventResult" (
    "roundId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "placement" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL,
    "source" "ResultSource" NOT NULL,

    CONSTRAINT "EventResult_pkey" PRIMARY KEY ("roundId","entryId")
);

-- CreateTable
CREATE TABLE "SeedSnapshot" (
    "id" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "hash" TEXT NOT NULL,
    "rows" JSONB NOT NULL,

    CONSTRAINT "SeedSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "reported" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_pseudo_key" ON "User"("pseudo");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GameAccount_game_externalId_key" ON "GameAccount"("game", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "Structure_name_key" ON "Structure"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Structure_tag_key" ON "Structure"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "Structure_inviteCode_key" ON "Structure"("inviteCode");

-- CreateIndex
CREATE INDEX "StructureStaff_userId_idx" ON "StructureStaff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_structureId_userId_key" ON "Invitation"("structureId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Roster_structureId_game_name_key" ON "Roster"("structureId", "game", "name");

-- CreateIndex
CREATE INDEX "RosterMember_userId_game_idx" ON "RosterMember"("userId", "game");

-- CreateIndex
CREATE INDEX "RankingEntry_game_score_idx" ON "RankingEntry"("game", "score");

-- CreateIndex
CREATE INDEX "Challenge_game_status_idx" ON "Challenge"("game", "status");

-- CreateIndex
CREATE INDEX "Challenge_challengerId_idx" ON "Challenge"("challengerId");

-- CreateIndex
CREATE INDEX "Challenge_defenderId_idx" ON "Challenge"("defenderId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_challengeId_key" ON "Match"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyEvent_game_month_key" ON "MonthlyEvent"("game", "month");

-- CreateIndex
CREATE UNIQUE INDEX "EventEntry_eventId_entityId_key" ON "EventEntry"("eventId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRound_eventId_n_key" ON "EventRound"("eventId", "n");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_target_at_idx" ON "AuditLog"("target", "at");

-- AddForeignKey
ALTER TABLE "GameAccount" ADD CONSTRAINT "GameAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameAccount" ADD CONSTRAINT "GameAccount_game_fkey" FOREIGN KEY ("game") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureStaff" ADD CONSTRAINT "StructureStaff_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "Structure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StructureStaff" ADD CONSTRAINT "StructureStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "Structure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roster" ADD CONSTRAINT "Roster_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "Structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roster" ADD CONSTRAINT "Roster_game_fkey" FOREIGN KEY ("game") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roster" ADD CONSTRAINT "Roster_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMember" ADD CONSTRAINT "RosterMember_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMember" ADD CONSTRAINT "RosterMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromStructureId_fkey" FOREIGN KEY ("fromStructureId") REFERENCES "Structure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toStructureId_fkey" FOREIGN KEY ("toStructureId") REFERENCES "Structure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitAd" ADD CONSTRAINT "RecruitAd_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Veto" ADD CONSTRAINT "Veto_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultSubmission" ADD CONSTRAINT "ResultSubmission_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultSubmission" ADD CONSTRAINT "ResultSubmission_eventRoundId_fkey" FOREIGN KEY ("eventRoundId") REFERENCES "EventRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultSubmission" ADD CONSTRAINT "ResultSubmission_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ResultSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventEntry" ADD CONSTRAINT "EventEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MonthlyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRound" ADD CONSTRAINT "EventRound_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MonthlyEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventResult" ADD CONSTRAINT "EventResult_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "EventRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventResult" ADD CONSTRAINT "EventResult_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "EventEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
