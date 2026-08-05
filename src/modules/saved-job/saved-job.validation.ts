import { z } from "zod";

export const savedJobsQuerySchema = z.object({
    page: z.coerce
        .number()
        .int("Page must be a whole number.")
        .positive("Page must be greater than zero.")
        .default(1),

    limit: z.coerce
        .number()
        .int("Limit must be a whole number.")
        .min(1, "Limit must be at least 1.")
        .max(50, "Limit cannot exceed 50.")
        .default(10),
});

export type SavedJobsQueryInput = z.infer<
    typeof savedJobsQuerySchema
>;
