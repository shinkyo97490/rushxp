-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "notifPrefs" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "privacy" JSONB NOT NULL DEFAULT '{}';
