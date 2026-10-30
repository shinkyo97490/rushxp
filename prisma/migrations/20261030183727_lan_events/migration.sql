-- CreateEnum
CREATE TYPE "LanStatus" AS ENUM ('DRAFT', 'ANNOUNCED', 'OPEN', 'CLOSED', 'DONE');

-- CreateEnum
CREATE TYPE "LanRegStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "LanEvent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizer" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "description" TEXT NOT NULL DEFAULT '',
    "posterUrl" TEXT,
    "status" "LanStatus" NOT NULL DEFAULT 'DRAFT',
    "refundUntil" TIMESTAMP(3),
    "visitorPassCents" INTEGER,
    "countsForGeneral" BOOLEAN NOT NULL DEFAULT true,
    "program" JSONB NOT NULL DEFAULT '[]',
    "resultsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanTournament" (
    "id" TEXT NOT NULL,
    "lanId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "priceCents" INTEGER,
    "capacity" INTEGER NOT NULL,
    "day" TEXT,

    CONSTRAINT "LanTournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanRegistration" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "structureId" TEXT,
    "members" TEXT[],
    "order" TEXT NOT NULL,
    "status" "LanRegStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "checkoutId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "LanRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LanResult" (
    "tournamentId" TEXT NOT NULL,
    "place" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "structureId" TEXT,

    CONSTRAINT "LanResult_pkey" PRIMARY KEY ("tournamentId","place")
);

-- CreateIndex
CREATE UNIQUE INDEX "LanEvent_slug_key" ON "LanEvent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LanTournament_lanId_game_key" ON "LanTournament"("lanId", "game");

-- CreateIndex
CREATE UNIQUE INDEX "LanRegistration_order_key" ON "LanRegistration"("order");

-- CreateIndex
CREATE UNIQUE INDEX "LanRegistration_tournamentId_entityId_key" ON "LanRegistration"("tournamentId", "entityId");

-- AddForeignKey
ALTER TABLE "LanTournament" ADD CONSTRAINT "LanTournament_lanId_fkey" FOREIGN KEY ("lanId") REFERENCES "LanEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanRegistration" ADD CONSTRAINT "LanRegistration_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "LanTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LanResult" ADD CONSTRAINT "LanResult_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "LanTournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
