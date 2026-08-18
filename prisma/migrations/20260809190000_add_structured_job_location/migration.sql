-- Add structured job location fields while preserving the existing display/search location.
ALTER TABLE "Job"
ADD COLUMN "city" TEXT,
ADD COLUMN "stateRegion" TEXT,
ADD COLUMN "countryCode" VARCHAR(2) NOT NULL DEFAULT 'US';

-- Conservatively backfill common U.S. physical locations such as "New York, NY".
-- Remote legacy locations are intentionally not inferred because the old display text
-- may describe a company location rather than an applicant eligibility boundary.
UPDATE "Job"
SET
    "city" = BTRIM(SPLIT_PART("location", ',', 1)),
    "stateRegion" = UPPER(BTRIM(SPLIT_PART("location", ',', 2)))
WHERE
    "workplaceType" <> 'REMOTE'
    AND "location" IS NOT NULL
    AND "location" ~ '^[^,]+,[[:space:]]*[A-Za-z]{2}[[:space:]]*$';

CREATE INDEX "Job_countryCode_stateRegion_city_idx"
ON "Job"("countryCode", "stateRegion", "city");
