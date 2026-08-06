import { z } from "zod";

export const contactInquiryTypes = [
    "GENERAL",
    "JOB_SEEKER",
    "EMPLOYER",
    "PARTNERSHIP",
    "TECHNICAL_SUPPORT",
    "FEEDBACK",
] as const;

const normalizeSingleLine = (value: string): string =>
    value.replace(/\s+/g, " ").trim();

export const contactSubmissionSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Name must contain at least 2 characters.")
        .max(80, "Name must not exceed 80 characters.")
        .transform(normalizeSingleLine),

    email: z
        .email("Enter a valid email address.")
        .trim()
        .toLowerCase()
        .max(254, "Email address is too long."),

    inquiryType: z.enum(contactInquiryTypes),

    subject: z
        .string()
        .trim()
        .min(3, "Subject must contain at least 3 characters.")
        .max(120, "Subject must not exceed 120 characters.")
        .transform(normalizeSingleLine),

    message: z
        .string()
        .trim()
        .min(20, "Message must contain at least 20 characters.")
        .max(5_000, "Message must not exceed 5,000 characters."),

    // Hidden honeypot field. Real users should always submit an empty value.
    website: z
        .string()
        .trim()
        .max(200)
        .optional()
        .default(""),
});

export type ContactSubmissionInput = z.infer<
    typeof contactSubmissionSchema
>;
