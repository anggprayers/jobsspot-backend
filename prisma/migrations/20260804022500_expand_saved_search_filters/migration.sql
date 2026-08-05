-- Add backward-compatible multi-select and advanced filter fields.
ALTER TABLE "SavedSearch"
ADD COLUMN "categorySlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "employmentTypes" "EmploymentType"[] NOT NULL DEFAULT ARRAY[]::"EmploymentType"[],
ADD COLUMN "workplaceTypes" "WorkplaceType"[] NOT NULL DEFAULT ARRAY[]::"WorkplaceType"[],
ADD COLUMN "experienceLevels" "ExperienceLevel"[] NOT NULL DEFAULT ARRAY[]::"ExperienceLevel"[],
ADD COLUMN "salaryPeriod" "SalaryPeriod",
ADD COLUMN "publishedWithinDays" INTEGER;

-- Preserve existing single-category saved searches.
UPDATE "SavedSearch" AS saved_search
SET "categorySlugs" = ARRAY[job_category."slug"]
FROM "JobCategory" AS job_category
WHERE saved_search."categoryId" = job_category."id"
  AND cardinality(saved_search."categorySlugs") = 0;

-- Preserve existing single enum selections.
UPDATE "SavedSearch"
SET "employmentTypes" = ARRAY["employmentType"]::"EmploymentType"[]
WHERE "employmentType" IS NOT NULL
  AND cardinality("employmentTypes") = 0;

UPDATE "SavedSearch"
SET "workplaceTypes" = ARRAY["workplaceType"]::"WorkplaceType"[]
WHERE "workplaceType" IS NOT NULL
  AND cardinality("workplaceTypes") = 0;

UPDATE "SavedSearch"
SET "experienceLevels" = ARRAY["experienceLevel"]::"ExperienceLevel"[]
WHERE "experienceLevel" IS NOT NULL
  AND cardinality("experienceLevels") = 0;

ALTER TABLE "SavedSearch"
ADD CONSTRAINT "SavedSearch_publishedWithinDays_check"
CHECK (
    "publishedWithinDays" IS NULL
    OR "publishedWithinDays" IN (1, 3, 7, 14, 30)
);
