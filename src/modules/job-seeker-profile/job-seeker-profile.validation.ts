import { z } from "zod";

import { EmploymentType } from "../../generated/prisma/client.js";

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

function normalizeOptionalDate(value: unknown): unknown {
    if (value === undefined || value === null || value === "") {
        return value === "" ? null : value;
    }

    return value;
}

const nullableHeadlineSchema = z.preprocess(
    normalizeOptionalText,
    z.string().max(120, "Headline must not exceed 120 characters.").nullable().optional(),
);

const nullableSummarySchema = z.preprocess(
    normalizeOptionalText,
    z.string().max(2000, "Summary must not exceed 2,000 characters.").nullable().optional(),
);

const nullableLocationSchema = z.preprocess(
    normalizeOptionalText,
    z.string().max(120, "Location must not exceed 120 characters.").nullable().optional(),
);

const nullableUrlSchema = (fieldLabel: string) =>
    z.preprocess(
        normalizeOptionalText,
        z
            .string()
            .url(`${fieldLabel} must be a valid URL.`)
            .max(500, `${fieldLabel} must not exceed 500 characters.`)
            .nullable()
            .optional(),
    );

const nullableYearsOfExperienceSchema = z.union([
    z
        .number()
        .int("Years of experience must be a whole number.")
        .min(0, "Years of experience cannot be negative.")
        .max(60, "Years of experience must not exceed 60."),
    z.null(),
]);

const nullableWorkLocationSchema = z.preprocess(
    normalizeOptionalText,
    z.string().max(150, "Location must not exceed 150 characters.").nullable().optional(),
);

const nullableDescriptionSchema = z.preprocess(
    normalizeOptionalText,
    z.string().max(3000, "Description must not exceed 3,000 characters.").nullable().optional(),
);

const nullableDateSchema = z.preprocess(normalizeOptionalDate, z.union([z.null(), z.coerce.date()]).optional());

export const updateJobSeekerProfileSchema = z
    .object({
        headline: nullableHeadlineSchema,
        summary: nullableSummarySchema,
        location: nullableLocationSchema,
        websiteUrl: nullableUrlSchema("Website URL"),
        linkedInUrl: nullableUrlSchema("LinkedIn URL"),
        yearsOfExperience: nullableYearsOfExperienceSchema.optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one profile field is required.",
    });

export const addJobSeekerSkillSchema = z
    .object({
        name: z.string().trim().min(1, "Skill name is required.").max(80, "Skill name must not exceed 80 characters."),

        yearsOfExperience: nullableYearsOfExperienceSchema.optional(),
    })
    .strict();

export const updateJobSeekerSkillSchema = z
    .object({
        yearsOfExperience: nullableYearsOfExperienceSchema,
    })
    .strict();

const workExperienceFieldsSchema = z.object({
    jobTitle: z.string().trim().min(1, "Job title is required.").max(120, "Job title must not exceed 120 characters."),

    companyName: z
        .string()
        .trim()
        .min(1, "Company name is required.")
        .max(120, "Company name must not exceed 120 characters."),

    employmentType: z.enum(EmploymentType).nullable().optional(),

    location: nullableWorkLocationSchema,

    startDate: z.coerce.date({
        error: "A valid start date is required.",
    }),

    endDate: nullableDateSchema,

    isCurrent: z.boolean().default(false),

    description: nullableDescriptionSchema,
});

export const createWorkExperienceSchema = workExperienceFieldsSchema
    .strict()
    .refine((data) => !data.isCurrent || data.endDate === null || data.endDate === undefined, {
        path: ["endDate"],
        message: "Current roles cannot have an end date.",
    })
    .refine((data) => data.endDate === null || data.endDate === undefined || data.endDate >= data.startDate, {
        path: ["endDate"],
        message: "End date cannot be earlier than start date.",
    });

export const updateWorkExperienceSchema = workExperienceFieldsSchema
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one work experience field is required.",
    })
    .refine((data) => data.isCurrent !== true || data.endDate === null || data.endDate === undefined, {
        path: ["endDate"],
        message: "Current roles cannot have an end date.",
    })
    .refine(
        (data) =>
            data.startDate === undefined ||
            data.endDate === null ||
            data.endDate === undefined ||
            data.endDate >= data.startDate,
        {
            path: ["endDate"],
            message: "End date cannot be earlier than start date.",
        },
    );

export type UpdateJobSeekerProfileBody = z.infer<typeof updateJobSeekerProfileSchema>;

export type AddJobSeekerSkillBody = z.infer<typeof addJobSeekerSkillSchema>;

export type UpdateJobSeekerSkillBody = z.infer<typeof updateJobSeekerSkillSchema>;

export type CreateWorkExperienceBody = z.infer<typeof createWorkExperienceSchema>;

export type UpdateWorkExperienceBody = z.infer<typeof updateWorkExperienceSchema>;
