import { z } from "zod";

import { ApplicationStatus } from "../../generated/prisma/client.js";

function normalizeOptionalText(value: unknown): unknown {
    if (value === undefined || value === null) {
        return value;
    }

    if (typeof value === "string") {
        const normalizedValue = value.trim();

        return normalizedValue === "" ? null : normalizedValue;
    }

    return value;
}

const nullableCoverLetterSchema = z.preprocess(
    normalizeOptionalText,
    z.string().max(5000, "Cover letter must not exceed 5,000 characters.").nullable().optional(),
);

export const createJobApplicationSchema = z
    .object({
        jobId: z.uuid("A valid job ID is required."),

        resumeId: z.uuid("A valid resume ID is required."),

        coverLetter: nullableCoverLetterSchema,
    })
    .strict();

export const jobSeekerApplicationsQuerySchema = z.object({
    status: z.enum(ApplicationStatus).optional(),

    page: z.coerce.number().int("Page must be a whole number.").positive("Page must be greater than zero.").default(1),

    limit: z.coerce
        .number()
        .int("Limit must be a whole number.")
        .min(1, "Limit must be at least 1.")
        .max(50, "Limit cannot exceed 50.")
        .default(10),
});

export type CreateJobApplicationInput = z.infer<typeof createJobApplicationSchema>;

export type JobSeekerApplicationsQueryInput = z.infer<typeof jobSeekerApplicationsQuerySchema>;
