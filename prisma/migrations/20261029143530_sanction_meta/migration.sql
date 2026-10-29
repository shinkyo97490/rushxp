-- AlterTable
ALTER TABLE "Sanction" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "liftedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Sanction_targetType_targetId_idx" ON "Sanction"("targetType", "targetId");
