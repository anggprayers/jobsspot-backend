import { z } from "zod";

import {
    EmploymentType,
    WorkplaceType,
} from "../../generated/prisma/client.js";

const normalizeSingleLine = (value: string): string =>
    value.replace(/\s+/g, " ").trim();

const emptyStringToUndefined = (value: unknown): unknown =>
    typeof value === "string" && value.trim() === ""
        ? undefined
        : value;

const optionalSingleLine = (
    minimum: number,
    maximum: number,
    minimumMessage: string,
    maximumMessage: string,
) =>
    z.preprocess(
        emptyStringToUndefined,
        z
            .string()
            .trim()
            .min(minimum, minimumMessage)
            .max(maximum, maximumMessage)
            .transform(normalizeSingleLine)
            .optional(),
    );

export const publicJobSubmissionSchema = z
    .object({
        jobTitle: z
            .string()
            .trim()
            .min(2, "Job title must contain at least 2 characters.")
            .max(120, "Job title must not exceed 120 characters.")
            .transform(normalizeSingleLine),

        companyName: z.preprocess(
            (value) => value == null ? "" : value,
            z
                .string()
                .trim()
                .max(120, "Company name must not exceed 120 characters.")
                .transform(normalizeSingleLine),
        ),

        companyWebsite: z.preprocess(
            emptyStringToUndefined,
            z
                .url("Enter a valid company website URL.")
                .max(500, "Company website URL is too long.")
                .refine(
                    (value) =>
                        value.startsWith("https://") ||
                        value.startsWith("http://"),
                    "Company website must use HTTP or HTTPS.",
                )
                .optional(),
        ),

        location: z
            .string()
            .trim()
            .min(2, "Location must contain at least 2 characters.")
            .max(160, "Location must not exceed 160 characters.")
            .transform(normalizeSingleLine),

        workplaceType: z.enum(WorkplaceType),
        employmentType: z.enum(EmploymentType),

        salaryText: optionalSingleLine(
            1,
            120,
            "Salary/pay rate is too short.",
            "Salary/pay rate must not exceed 120 characters.",
        ),

        description: z
            .string()
            .trim()
            .min(20, "Job description must contain at least 20 characters.")
            .max(5_000, "Job description must not exceed 5,000 characters."),

        contactName: optionalSingleLine(
            2,
            80,
            "Contact name must contain at least 2 characters.",
            "Contact name must not exceed 80 characters.",
        ),

        contactEmail: z
            .email("Enter a valid contact email address.")
            .trim()
            .toLowerCase()
            .max(254, "Contact email address is too long."),

        contactPhone: z.preprocess(
            emptyStringToUndefined,
            z
                .string()
                .trim()
                .min(7, "Contact phone number is too short.")
                .max(30, "Contact phone number is too long.")
                .regex(
                    /^[0-9+().\-\s]+$/,
                    "Contact phone number contains unsupported characters.",
                )
                .transform(normalizeSingleLine)
                .optional(),
        ),

        // Honeypot. The real company website is `companyWebsite`; this field
        // should remain empty in normal browser submissions.
        website: z
            .string()
            .trim()
            .max(200)
            .optional()
            .default(""),
    })
    .strict();

export type PublicJobSubmissionInput = z.infer<
    typeof publicJobSubmissionSchema
>;
