-- CreateEnum
CREATE TYPE "JobSubmissionStatus" AS ENUM ('SUBMITTED', 'CONTACTED', 'APPROVED', 'REJECTED', 'PUBLISHED');

-- CreateTable
CREATE TABLE "JobSubmission" (
    "id" UUID NOT NULL,
    "referenceCode" VARCHAR(32) NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyWebsite" TEXT,
    "locationText" TEXT NOT NULL,
    "workplaceType" "WorkplaceType" NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "salaryText" TEXT,
    "description" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "status" "JobSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "internalNotes" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "contactedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "companyId" UUID,
    "publishedJobId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobSubmission_referenceCode_key" ON "JobSubmission"("referenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "JobSubmission_publishedJobId_key" ON "JobSubmission"("publishedJobId");

-- CreateIndex
CREATE INDEX "JobSubmission_status_createdAt_idx" ON "JobSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "JobSubmission_contactEmail_createdAt_idx" ON "JobSubmission"("contactEmail", "createdAt");

-- CreateIndex
CREATE INDEX "JobSubmission_companyId_idx" ON "JobSubmission"("companyId");

-- CreateIndex
CREATE INDEX "JobSubmission_reviewedById_idx" ON "JobSubmission"("reviewedById");

-- AddForeignKey
ALTER TABLE "JobSubmission"
ADD CONSTRAINT "JobSubmission_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSubmission"
ADD CONSTRAINT "JobSubmission_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSubmission"
ADD CONSTRAINT "JobSubmission_publishedJobId_fkey"
FOREIGN KEY ("publishedJobId") REFERENCES "Job"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
