import { z } from "zod";

export const trackPopularSearchSchema = z
    .object({
        keyword: z
            .string()
            .trim()
            .min(
                2,
                "Search keyword must contain at least 2 characters.",
            )
            .max(
                100,
                "Search keyword must not exceed 100 characters.",
            ),
    })
    .strict();

export const popularSearchesQuerySchema = z
    .object({
        limit: z.coerce
            .number()
            .int("Limit must be a whole number.")
            .min(1, "Limit must be at least 1.")
            .max(10, "Limit cannot exceed 10.")
            .default(4),

        days: z.coerce
            .number()
            .int("Days must be a whole number.")
            .min(1, "Days must be at least 1.")
            .max(90, "Days cannot exceed 90.")
            .default(30),
    })
    .strict();

export type TrackPopularSearchBody = z.infer<
    typeof trackPopularSearchSchema
>;

export type PopularSearchesQuery = z.infer<
    typeof popularSearchesQuerySchema
>;
