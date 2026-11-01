-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "games" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ResultSubmission" ADD COLUMN     "games" JSONB NOT NULL DEFAULT '[]';

