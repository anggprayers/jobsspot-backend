import { z } from "zod";

import { ApplicationStatus } from "../../generated/prisma/client.js";

export const employerApplicationsQuerySchema = z.object({
    search: z.string().trim().max(120, "Search cannot exceed 120 characters.").optional(),

    jobId: z.string().uuid("A valid job ID is required.").optional(),

    status: z.enum(ApplicationStatus).optional(),

    page: z.coerce.number().int().positive("Page must be greater than zero.").default(1),

    limit: z.coerce.number().int().min(1, "Limit must be at least 1.").max(50, "Limit cannot exceed 50.").default(10),
});

const employerManageableStatuses = [
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFERED,
    ApplicationStatus.HIRED,
    ApplicationStatus.REJECTED,
] as const;

export const updateEmployerApplicationStatusSchema = z.object({
    status: z.enum(employerManageableStatuses),
});

export type EmployerApplicationsQueryInput = z.infer<typeof employerApplicationsQuerySchema>;

export type UpdateEmployerApplicationStatusInput = z.infer<typeof updateEmployerApplicationStatusSchema>;
