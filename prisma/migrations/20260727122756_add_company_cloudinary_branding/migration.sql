/*
  Warnings:

  - You are about to drop the column `bannerKey` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `logoKey` on the `Company` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Company" DROP COLUMN "bannerKey",
DROP COLUMN "logoKey",
ADD COLUMN     "bannerPublicId" TEXT,
ADD COLUMN     "logoPublicId" TEXT;
