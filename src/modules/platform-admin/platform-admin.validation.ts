import { z } from "zod";

import { JobReportReason, JobReportStatus, JobStatus } from "../../generated/prisma/client.js";

export const adminUuidParamsSchema = z.object({
    userId: z.uuid("A valid user ID is required."),
});

export const adminCompanyUuidParamsSchema = z.object({
    companyId: z.uuid("A valid company ID is required."),
});

export const adminJobUuidParamsSchema = z.object({
    jobId: z.uuid("A valid job ID is required."),
});

export const adminJobReportUuidParamsSchema = z.object({
    reportId: z.uuid("A valid report ID is required."),
});

export const adminUserListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    status: z.enum(["ALL", "ACTIVE", "SUSPENDED", "DELETED"]).default("ALL"),
    accountType: z.enum(["ALL", "ADMIN", "STANDARD"]).default("ALL"),
    sort: z.enum(["NEWEST", "OLDEST", "NAME_ASC", "NAME_DESC"]).default("NEWEST"),
});

export const adminCompanyListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    status: z.enum(["ALL", "ACTIVE", "SUSPENDED", "DELETED"]).default("ALL"),
    verification: z.enum(["ALL", "VERIFIED", "UNVERIFIED"]).default("ALL"),
    sort: z.enum(["NEWEST", "OLDEST", "NAME_ASC", "NAME_DESC"]).default("NEWEST"),
});

export const adminJobListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    status: z.union([z.literal("ALL"), z.enum(JobStatus)]).default("ALL"),
    moderation: z.enum(["ALL", "VISIBLE", "HIDDEN"]).default("ALL"),
    recordState: z.enum(["ALL", "ACTIVE", "DELETED"]).default("ACTIVE"),
    companyId: z.uuid("A valid company ID is required.").optional(),
    sort: z.enum(["NEWEST", "OLDEST", "TITLE_ASC", "TITLE_DESC"]).default("NEWEST"),
});

export const adminJobModerationSchema = z
    .object({
        hidden: z.boolean(),
        reason: z.string().trim().min(10).max(500).optional(),
    })
    .superRefine((value, context) => {
        if (value.hidden && !value.reason) {
            context.addIssue({
                code: "custom",
                path: ["reason"],
                message: "A moderation reason containing at least 10 characters is required.",
            });
        }
    });

export const adminJobReportListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    status: z.union([z.literal("ALL"), z.enum(JobReportStatus)]).default("ALL"),
    reason: z.union([z.literal("ALL"), z.enum(JobReportReason)]).default("ALL"),
    sort: z.enum(["NEWEST", "OLDEST"]).default("NEWEST"),
});

export const adminJobReportStatusSchema = z
    .object({
        status: z.enum([
            JobReportStatus.UNDER_REVIEW,
            JobReportStatus.RESOLVED,
            JobReportStatus.DISMISSED,
        ]),
        resolutionNote: z.string().trim().max(1000).optional(),
    })
    .superRefine((value, context) => {
        if (
            (value.status === JobReportStatus.RESOLVED || value.status === JobReportStatus.DISMISSED) &&
            (!value.resolutionNote || value.resolutionNote.length < 5)
        ) {
            context.addIssue({
                code: "custom",
                path: ["resolutionNote"],
                message: "Add a short resolution note containing at least 5 characters.",
            });
        }
    });

export const adminUserSuspensionSchema = z
    .object({
        suspended: z.boolean(),
        reason: z.string().trim().min(10).max(500).optional(),
    })
    .superRefine((value, context) => {
        if (value.suspended && !value.reason) {
            context.addIssue({
                code: "custom",
                path: ["reason"],
                message: "A suspension reason containing at least 10 characters is required.",
            });
        }
    });

export const adminCompanySuspensionSchema = z
    .object({
        suspended: z.boolean(),
        reason: z.string().trim().min(10).max(500).optional(),
    })
    .superRefine((value, context) => {
        if (value.suspended && !value.reason) {
            context.addIssue({
                code: "custom",
                path: ["reason"],
                message: "A suspension reason containing at least 10 characters is required.",
            });
        }
    });

export const adminCompanyVerificationSchema = z.object({
    verified: z.boolean(),
});

export const platformActivityQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    action: z.string().trim().min(1).max(100).optional(),
    entityType: z.string().trim().min(1).max(100).optional(),
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type AdminCompanyListQuery = z.infer<typeof adminCompanyListQuerySchema>;
export type AdminUserSuspensionInput = z.infer<typeof adminUserSuspensionSchema>;
export type AdminCompanySuspensionInput = z.infer<typeof adminCompanySuspensionSchema>;
export type AdminCompanyVerificationInput = z.infer<typeof adminCompanyVerificationSchema>;
export type AdminJobListQuery = z.infer<typeof adminJobListQuerySchema>;
export type AdminJobModerationInput = z.infer<typeof adminJobModerationSchema>;
export type AdminJobReportListQuery = z.infer<typeof adminJobReportListQuerySchema>;
export type AdminJobReportStatusInput = z.infer<typeof adminJobReportStatusSchema>;
export type PlatformActivityQuery = z.infer<typeof platformActivityQuerySchema>;
