-- CreateTable
CREATE TABLE "MatchMvp" (
    "matchId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchMvp_pkey" PRIMARY KEY ("matchId","voterId")
);

-- CreateIndex
CREATE INDEX "MatchMvp_playerId_idx" ON "MatchMvp"("playerId");

-- AddForeignKey
ALTER TABLE "MatchMvp" ADD CONSTRAINT "MatchMvp_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

