-- CreateTable
CREATE TABLE "CompanyInvitation" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "CompanyMemberRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" UUID NOT NULL,
    "acceptedById" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3),
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInvitation_tokenHash_key" ON "CompanyInvitation"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInvitation_companyId_email_key" ON "CompanyInvitation"("companyId", "email");

-- CreateIndex
CREATE INDEX "CompanyInvitation_companyId_acceptedAt_cancelledAt_expiresAt_idx"
ON "CompanyInvitation"("companyId", "acceptedAt", "cancelledAt", "expiresAt");

-- CreateIndex
CREATE INDEX "CompanyInvitation_invitedById_idx" ON "CompanyInvitation"("invitedById");

-- CreateIndex
CREATE INDEX "CompanyInvitation_acceptedById_idx" ON "CompanyInvitation"("acceptedById");

-- CreateIndex
CREATE INDEX "CompanyInvitation_expiresAt_idx" ON "CompanyInvitation"("expiresAt");

-- AddForeignKey
ALTER TABLE "CompanyInvitation"
ADD CONSTRAINT "CompanyInvitation_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvitation"
ADD CONSTRAINT "CompanyInvitation_invitedById_fkey"
FOREIGN KEY ("invitedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInvitation"
ADD CONSTRAINT "CompanyInvitation_acceptedById_fkey"
FOREIGN KEY ("acceptedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
