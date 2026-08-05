import { z } from "zod";

import {
    EmploymentType,
    ExperienceLevel,
    SalaryPeriod,
    WorkplaceType,
} from "../../generated/prisma/client.js";

const publicJobSortValues = [
    "newest",
    "oldest",
    "salary_high",
    "salary_low",
] as const;

const allowedPublishedWithinDays = [
    1,
    3,
    7,
    14,
    30,
] as const;

function splitQueryValues(value: unknown): unknown {
    if (value === undefined) {
        return undefined;
    }

    const values = Array.isArray(value)
        ? value
        : [value];

    const normalizedValues = values.flatMap(
        (item) =>
            typeof item === "string"
                ? item
                      .split(",")
                      .map((entry) => entry.trim())
                      .filter(Boolean)
                : [item],
    );

    return normalizedValues;
}

function uniqueValues<T>(values: T[]): T[] {
    return [...new Set(values)];
}

const categoryFilterSchema = z.preprocess(
    splitQueryValues,
    z
        .array(
            z
                .string()
                .trim()
                .min(
                    1,
                    "Category cannot be empty.",
                )
                .max(
                    100,
                    "Category cannot exceed 100 characters.",
                ),
        )
        .min(
            1,
            "At least one category is required.",
        )
        .max(
            20,
            "A maximum of 20 categories can be selected.",
        )
        .transform(uniqueValues)
        .optional(),
);

const employmentTypeFilterSchema = z.preprocess(
    splitQueryValues,
    z
        .array(z.enum(EmploymentType))
        .min(
            1,
            "At least one employment type is required.",
        )
        .max(
            Object.values(EmploymentType).length,
            "Too many employment types were selected.",
        )
        .transform(uniqueValues)
        .optional(),
);

const workplaceTypeFilterSchema = z.preprocess(
    splitQueryValues,
    z
        .array(z.enum(WorkplaceType))
        .min(
            1,
            "At least one workplace type is required.",
        )
        .max(
            Object.values(WorkplaceType).length,
            "Too many workplace types were selected.",
        )
        .transform(uniqueValues)
        .optional(),
);

const experienceLevelFilterSchema = z.preprocess(
    splitQueryValues,
    z
        .array(z.enum(ExperienceLevel))
        .min(
            1,
            "At least one experience level is required.",
        )
        .max(
            Object.values(ExperienceLevel).length,
            "Too many experience levels were selected.",
        )
        .transform(uniqueValues)
        .optional(),
);

const optionalSalarySchema = z.preprocess(
    (value) => {
        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            return undefined;
        }

        return value;
    },
    z.coerce
        .number()
        .finite("Salary must be a valid number.")
        .min(
            0,
            "Salary cannot be negative.",
        )
        .max(
            999_999_999.99,
            "Salary is too large.",
        )
        .optional(),
);

export const getPublicJobsQuerySchema = z
    .object({
        page: z.coerce
            .number()
            .int(
                "Page must be a whole number.",
            )
            .positive(
                "Page must be greater than 0.",
            )
            .default(1),

        limit: z.coerce
            .number()
            .int(
                "Limit must be a whole number.",
            )
            .min(
                1,
                "Limit must be at least 1.",
            )
            .max(
                100,
                "Limit cannot exceed 100.",
            )
            .default(20),

        search: z
            .string()
            .trim()
            .min(
                1,
                "Search cannot be empty.",
            )
            .max(
                100,
                "Search cannot exceed 100 characters.",
            )
            .optional(),

        category: categoryFilterSchema,

        employmentType:
            employmentTypeFilterSchema,

        workplaceType:
            workplaceTypeFilterSchema,

        experienceLevel:
            experienceLevelFilterSchema,

        location: z
            .string()
            .trim()
            .min(
                1,
                "Location cannot be empty.",
            )
            .max(
                150,
                "Location cannot exceed 150 characters.",
            )
            .optional(),

        salaryPeriod:
            z.enum(SalaryPeriod).optional(),

        salaryMin: optionalSalarySchema,

        salaryMax: optionalSalarySchema,

        salaryCurrency: z
            .string()
            .trim()
            .length(
                3,
                "Salary currency must contain exactly 3 characters.",
            )
            .regex(
                /^[A-Za-z]{3}$/,
                "Salary currency must be a valid 3-letter code.",
            )
            .transform((value) =>
                value.toUpperCase(),
            )
            .optional(),

        publishedWithinDays: z.coerce
            .number()
            .int(
                "Listing time must be a whole number of days.",
            )
            .refine(
                (
                    value,
                ): value is (typeof allowedPublishedWithinDays)[number] =>
                    allowedPublishedWithinDays.includes(
                        value as (typeof allowedPublishedWithinDays)[number],
                    ),
                {
                    message:
                        "Listing time must be 1, 3, 7, 14, or 30 days.",
                },
            )
            .optional(),

        sort: z
            .enum(publicJobSortValues)
            .default("newest"),
    })
    .strict()
    .superRefine((query, context) => {
        if (
            query.salaryMin !== undefined &&
            query.salaryMax !== undefined &&
            query.salaryMax < query.salaryMin
        ) {
            context.addIssue({
                code: "custom",
                path: ["salaryMax"],
                message:
                    "Maximum salary cannot be lower than minimum salary.",
            });
        }

        const hasSalaryAmount =
            query.salaryMin !== undefined ||
            query.salaryMax !== undefined;

        if (
            hasSalaryAmount &&
            query.salaryPeriod === undefined
        ) {
            context.addIssue({
                code: "custom",
                path: ["salaryPeriod"],
                message:
                    "Salary period is required when filtering by salary amount.",
            });
        }
    });

export type GetPublicJobsQuery = z.infer<
    typeof getPublicJobsQuerySchema
>;
