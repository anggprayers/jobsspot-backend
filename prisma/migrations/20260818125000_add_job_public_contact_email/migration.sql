-- Optional public recruiter/hiring contact shown on published job details.
ALTER TABLE "Job"
ADD COLUMN "publicContactEmail" VARCHAR(254);
