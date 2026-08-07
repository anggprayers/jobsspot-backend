-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "emailProcessedAt" TIMESTAMP(3);

-- Existing in-app notifications predate email delivery. Mark them processed so enabling email does not send historical backlog.
UPDATE "Notification" SET "emailProcessedAt" = CURRENT_TIMESTAMP WHERE "emailProcessedAt" IS NULL;

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "jobSeekerApplicationUpdatesEmail" BOOLEAN NOT NULL DEFAULT true,
    "jobSeekerApplicationViewedEmail" BOOLEAN NOT NULL DEFAULT false,
    "employerApplicationEmail" BOOLEAN NOT NULL DEFAULT true,
    "employerTeamEmail" BOOLEAN NOT NULL DEFAULT true,
    "employerJobEmail" BOOLEAN NOT NULL DEFAULT true,
    "systemEmail" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key"
ON "NotificationPreference"("userId");

-- AddForeignKey
ALTER TABLE "NotificationPreference"
ADD CONSTRAINT "NotificationPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
