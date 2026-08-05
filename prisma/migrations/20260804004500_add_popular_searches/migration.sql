-- CreateTable
CREATE TABLE "PopularSearch" (
    "id" UUID NOT NULL,
    "keyword" TEXT NOT NULL,
    "normalizedTerm" TEXT NOT NULL,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "lastSearchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PopularSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopularSearchDailyCount" (
    "id" UUID NOT NULL,
    "popularSearchId" UUID NOT NULL,
    "searchDate" DATE NOT NULL,
    "searchCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PopularSearchDailyCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PopularSearch_normalizedTerm_key"
ON "PopularSearch"("normalizedTerm");

-- CreateIndex
CREATE INDEX "PopularSearch_searchCount_lastSearchedAt_idx"
ON "PopularSearch"("searchCount", "lastSearchedAt");

-- CreateIndex
CREATE INDEX "PopularSearch_lastSearchedAt_idx"
ON "PopularSearch"("lastSearchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PopularSearchDailyCount_popularSearchId_searchDate_key"
ON "PopularSearchDailyCount"("popularSearchId", "searchDate");

-- CreateIndex
CREATE INDEX "PopularSearchDailyCount_searchDate_searchCount_idx"
ON "PopularSearchDailyCount"("searchDate", "searchCount");

-- CreateIndex
CREATE INDEX "PopularSearchDailyCount_popularSearchId_idx"
ON "PopularSearchDailyCount"("popularSearchId");

-- AddForeignKey
ALTER TABLE "PopularSearchDailyCount"
ADD CONSTRAINT "PopularSearchDailyCount_popularSearchId_fkey"
FOREIGN KEY ("popularSearchId")
REFERENCES "PopularSearch"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
