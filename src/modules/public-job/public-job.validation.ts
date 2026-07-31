import { z } from "zod";

import { EmploymentType, ExperienceLevel, WorkplaceType } from "../../generated/prisma/client.js";

const publicJobSortValues = ["newest", "oldest", "salary_high", "salary_low"] as const;

export const getPublicJobsQuerySchema = z.object({
    page: z.coerce.number().int("Page must be a whole number.").positive("Page must be greater than 0.").default(1),

    limit: z.coerce
        .number()
        .int("Limit must be a whole number.")
        .min(1, "Limit must be at least 1.")
        .max(100, "Limit cannot exceed 100.")
        .default(20),

    search: z
        .string()
        .trim()
        .min(1, "Search cannot be empty.")
        .max(100, "Search cannot exceed 100 characters.")
        .optional(),

    category: z
        .string()
        .trim()
        .min(1, "Category cannot be empty.")
        .max(100, "Category cannot exceed 100 characters.")
        .optional(),

    employmentType: z.enum(EmploymentType).optional(),

    workplaceType: z.enum(WorkplaceType).optional(),

    experienceLevel: z.enum(ExperienceLevel).optional(),

    location: z
        .string()
        .trim()
        .min(1, "Location cannot be empty.")
        .max(150, "Location cannot exceed 150 characters.")
        .optional(),

    sort: z.enum(publicJobSortValues).default("newest"),
});

export type GetPublicJobsQuery = z.infer<typeof getPublicJobsQuerySchema>;
