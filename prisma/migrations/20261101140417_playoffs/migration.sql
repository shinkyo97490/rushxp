-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "round" TEXT,
ADD COLUMN     "seasonYear" INTEGER;

-- AlterTable
ALTER TABLE "SeedSnapshot" ADD COLUMN     "year" INTEGER NOT NULL DEFAULT 2026;

-- CreateIndex
CREATE UNIQUE INDEX "SeedSnapshot_game_year_key" ON "SeedSnapshot"("game", "year");

