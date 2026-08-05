import { z } from "zod";

export const auditEntityTypeSchema = z.enum([
    "APPLICATION",
    "JOB",
    "COMPANY_MEMBERSHIP",
    "COMPANY_INVITATION",
    "COMPANY",
]);

export const companyActivityQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(50).default(20),

    action: z
        .string()
        .trim()
        .min(1, "Action cannot be empty.")
        .max(100, "Action must not exceed 100 characters.")
        .optional(),

    entityType: auditEntityTypeSchema.optional(),
});

export type CompanyActivityQuery = z.infer<typeof companyActivityQuerySchema>;
