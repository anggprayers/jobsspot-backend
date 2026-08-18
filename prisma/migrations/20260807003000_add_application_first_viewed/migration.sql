-- AlterTable
ALTER TABLE "Application"
ADD COLUMN "firstViewedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Application_firstViewedAt_idx"
ON "Application"("firstViewedAt");
