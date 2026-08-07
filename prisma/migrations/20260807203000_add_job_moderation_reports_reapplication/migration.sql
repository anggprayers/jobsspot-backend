-- CreateEnum
CREATE TYPE "JobReportReason" AS ENUM ('SCAM_FRAUD', 'MISLEADING', 'DISCRIMINATION', 'SPAM_DUPLICATE', 'INAPPROPRIATE', 'OTHER');

-- CreateEnum
CREATE TYPE "JobReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Job"
ADD COLUMN "adminHiddenAt" TIMESTAMP(3),
ADD COLUMN "adminHiddenReason" TEXT,
ADD COLUMN "adminHiddenById" UUID;

-- Replace the one-application-ever constraint with a history-friendly lookup index.
DROP INDEX IF EXISTS "Application_jobId_applicantId_key";
CREATE INDEX "Application_jobId_applicantId_appliedAt_idx" ON "Application"("jobId", "applicantId", "appliedAt");

-- CreateTable
CREATE TABLE "JobReport" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "reporterUserId" UUID NOT NULL,
    "reason" "JobReportReason" NOT NULL,
    "details" TEXT,
    "status" "JobReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolutionNote" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_adminHiddenAt_idx" ON "Job"("adminHiddenAt");
CREATE INDEX "Job_adminHiddenById_idx" ON "Job"("adminHiddenById");
CREATE UNIQUE INDEX "JobReport_jobId_reporterUserId_key" ON "JobReport"("jobId", "reporterUserId");
CREATE INDEX "JobReport_status_createdAt_idx" ON "JobReport"("status", "createdAt");
CREATE INDEX "JobReport_reason_createdAt_idx" ON "JobReport"("reason", "createdAt");
CREATE INDEX "JobReport_jobId_status_idx" ON "JobReport"("jobId", "status");
CREATE INDEX "JobReport_reviewedById_idx" ON "JobReport"("reviewedById");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_adminHiddenById_fkey" FOREIGN KEY ("adminHiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobReport" ADD CONSTRAINT "JobReport_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobReport" ADD CONSTRAINT "JobReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobReport" ADD CONSTRAINT "JobReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
