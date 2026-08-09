import { z } from "zod";

import {
    EmploymentType,
    ExperienceLevel,
    JobStatus,
    SalaryPeriod,
    WorkplaceType,
} from "../../generated/prisma/client.js";

const salaryCurrencySchema = z
    .string()
    .trim()
    .length(3, "Currency must use a 3-letter code.")
    .transform((value) => value.toUpperCase());

const countryCodeSchema = z
    .string()
    .trim()
    .length(2, "Country must use a 2-letter code.")
    .regex(/^[A-Za-z]{2}$/, "Country must use a valid 2-letter code.")
    .transform((value) => value.toUpperCase());

const optionalLocationPartSchema = z
    .union([
        z
            .string()
            .trim()
            .min(1, "Location fields cannot be empty when provided.")
            .max(100, "Location fields cannot exceed 100 characters."),
        z.null(),
    ])
    .optional();

const jobFieldsSchema = z.object({
    categoryId: z.string().uuid("A valid job category ID is required."),

    title: z
        .string()
        .trim()
        .min(3, "Job title must contain at least 3 characters.")
        .max(120, "Job title cannot exceed 120 characters."),

    description: z
        .string()
        .trim()
        .min(50, "Job description must contain at least 50 characters.")
        .max(10000, "Job description cannot exceed 10,000 characters."),

    requirements: z.string().trim().max(5000, "Job requirements cannot exceed 5,000 characters.").optional(),

    responsibilities: z.string().trim().max(5000, "Job responsibilities cannot exceed 5,000 characters.").optional(),

    employmentType: z.enum(EmploymentType),

    workplaceType: z.enum(WorkplaceType),

    experienceLevel: z.enum(ExperienceLevel),

    city: optionalLocationPartSchema,

    stateRegion: optionalLocationPartSchema,

    countryCode: countryCodeSchema.default("US"),

    salaryMin: z.number().nonnegative("Minimum salary cannot be negative.").optional(),

    salaryMax: z.number().nonnegative("Maximum salary cannot be negative.").optional(),

    salaryCurrency: salaryCurrencySchema.default("USD"),

    salaryPeriod: z.enum(SalaryPeriod).optional(),

    applicationDeadline: z.coerce.date().optional(),
});

function addSharedJobValidationIssues(
    data: {
        salaryMin?: number | undefined;
        salaryMax?: number | undefined;
        applicationDeadline?: Date | undefined;
        workplaceType?: WorkplaceType | undefined;
        city?: string | null | undefined;
        stateRegion?: string | null | undefined;
        countryCode?: string | undefined;
    },
    context: z.RefinementCtx,
) {
    if (
        data.salaryMin !== undefined &&
        data.salaryMax !== undefined &&
        data.salaryMax < data.salaryMin
    ) {
        context.addIssue({
            code: "custom",
            message: "Maximum salary must be greater than or equal to minimum salary.",
            path: ["salaryMax"],
        });
    }

    if (data.applicationDeadline !== undefined && data.applicationDeadline <= new Date()) {
        context.addIssue({
            code: "custom",
            message: "Application deadline must be in the future.",
            path: ["applicationDeadline"],
        });
    }

    if (data.workplaceType && data.workplaceType !== WorkplaceType.REMOTE) {
        if (!data.city?.trim()) {
            context.addIssue({
                code: "custom",
                message: "City is required for an on-site or hybrid job.",
                path: ["city"],
            });
        }

        if (!data.stateRegion?.trim()) {
            context.addIssue({
                code: "custom",
                message: "State or region is required for an on-site or hybrid job.",
                path: ["stateRegion"],
            });
        }
    }
}

export const createJobSchema = jobFieldsSchema.superRefine((data, context) => {
    addSharedJobValidationIssues(data, context);
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

const updateJobFieldsSchema = jobFieldsSchema.partial().extend({
    salaryCurrency: salaryCurrencySchema.optional(),
    countryCode: countryCodeSchema.optional(),
});

export const updateJobSchema = updateJobFieldsSchema
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one job field must be provided.",
    })
    .superRefine((data, context) => {
        addSharedJobValidationIssues(data, context);
    });

export type UpdateJobInput = z.infer<typeof updateJobSchema>;

export const companyJobsQuerySchema = z.object({
    search: z.string().trim().max(120, "Search cannot exceed 120 characters.").optional(),

    status: z.enum(JobStatus).optional(),

    page: z.coerce.number().int().positive("Page must be greater than zero.").default(1),

    limit: z.coerce.number().int().min(1, "Limit must be at least 1.").max(50, "Limit cannot exceed 50.").default(10),
});

export type CompanyJobsQueryInput = z.infer<typeof companyJobsQuerySchema>;
