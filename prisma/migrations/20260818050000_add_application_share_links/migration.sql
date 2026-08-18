CREATE TABLE "ApplicationShareLink" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "includeResume" BOOLEAN NOT NULL DEFAULT true,
    "includeCoverLetter" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationShareLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApplicationShareLink_tokenHash_key" ON "ApplicationShareLink"("tokenHash");
CREATE INDEX "ApplicationShareLink_applicationId_createdAt_idx" ON "ApplicationShareLink"("applicationId", "createdAt");
CREATE INDEX "ApplicationShareLink_createdById_createdAt_idx" ON "ApplicationShareLink"("createdById", "createdAt");
CREATE INDEX "ApplicationShareLink_expiresAt_idx" ON "ApplicationShareLink"("expiresAt");
CREATE INDEX "ApplicationShareLink_revokedAt_idx" ON "ApplicationShareLink"("revokedAt");

ALTER TABLE "ApplicationShareLink"
ADD CONSTRAINT "ApplicationShareLink_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationShareLink"
ADD CONSTRAINT "ApplicationShareLink_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
