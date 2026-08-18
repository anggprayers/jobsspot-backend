import { z } from "zod";

import { ApplicationStatus, JobReportReason, JobReportStatus, JobStatus, JobSubmissionStatus } from "../../generated/prisma/client.js";
import { createCompanySchema, updateCompanySchema } from "../company/company.validation.js";
import { createJobSchema, updateJobSchema } from "../job/job.validation.js";

export const adminUuidParamsSchema = z.object({
    userId: z.uuid("A valid user ID is required."),
});

export const adminCompanyUuidParamsSchema = z.object({
    companyId: z.uuid("A valid company ID is required."),
});


export const adminCategoryUuidParamsSchema = z.object({
    categoryId: z.uuid("A valid job category ID is required."),
});

export const adminCategoryListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
    sort: z.enum(["ORDER_ASC", "NAME_ASC", "NAME_DESC", "NEWEST"]).default("ORDER_ASC"),
});

export const adminCategoryCreateSchema = z.object({
    name: z.string().trim().min(2, "Category name must contain at least 2 characters.").max(80),
    displayOrder: z.coerce.number().int().min(0).max(10_000).optional(),
});

export const adminCategoryUpdateSchema = z
    .object({
        name: z.string().trim().min(2, "Category name must contain at least 2 characters.").max(80).optional(),
        displayOrder: z.coerce.number().int().min(0).max(10_000).optional(),
    })
    .refine((value) => value.name !== undefined || value.displayOrder !== undefined, {
        message: "Provide a category name or display order to update.",
    });

export const adminCategoryStatusSchema = z.object({
    active: z.boolean(),
});

export const adminJobUuidParamsSchema = z.object({
    jobId: z.uuid("A valid job ID is required."),
});

export const adminJobReportUuidParamsSchema = z.object({
    reportId: z.uuid("A valid report ID is required."),
});



export const adminApplicationUuidParamsSchema = z.object({
    applicationId: z.uuid("A valid application ID is required."),
});

export const adminApplicationShareUuidParamsSchema = z.object({
    applicationId: z.uuid("A valid application ID is required."),
    shareLinkId: z.uuid("A valid application share-link ID is required."),
});

export const adminApplicationListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    status: z.union([z.literal("ALL"), z.enum(ApplicationStatus)]).default("ALL"),
    jobId: z.uuid("A valid job ID is required.").optional(),
    companyId: z.uuid("A valid company ID is required.").optional(),
    sort: z.enum(["NEWEST", "OLDEST"]).default("NEWEST"),
});

export const adminApplicationStatusSchema = z.object({
    status: z.enum([
        ApplicationStatus.UNDER_REVIEW,
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.OFFERED,
        ApplicationStatus.HIRED,
        ApplicationStatus.REJECTED,
    ]),
});

export const adminApplicationShareCreateSchema = z.object({
    expiresInHours: z.coerce.number().int().min(1).max(168).default(24),
    includeResume: z.boolean().default(true),
    includeCoverLetter: z.boolean().default(false),
});

export const adminJobSubmissionUuidParamsSchema = z.object({
    submissionId: z.uuid("A valid job submission ID is required."),
});

export const adminJobSubmissionListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    status: z.union([z.literal("ALL"), z.enum(JobSubmissionStatus)]).default("ALL"),
    sort: z.enum(["NEWEST", "OLDEST"]).default("NEWEST"),
});

export const adminJobSubmissionContactSchema = z.object({
    internalNotes: z.string().trim().max(2000).optional(),
});

export const adminJobSubmissionRejectSchema = z.object({
    reason: z
        .string()
        .trim()
        .min(5, "Add a rejection reason containing at least 5 characters.")
        .max(2000, "Rejection reason cannot exceed 2,000 characters."),
});

const adminExistingSubmissionCompanySchema = z.object({
    mode: z.literal("EXISTING"),
    companyId: z.uuid("A valid company ID is required."),
});

const adminNewSubmissionCompanySchema = createCompanySchema.extend({
    mode: z.literal("NEW"),
});

export const adminJobSubmissionPublishSchema = z.object({
    company: z.discriminatedUnion("mode", [
        adminExistingSubmissionCompanySchema,
        adminNewSubmissionCompanySchema,
    ]),
    job: createJobSchema,
    internalNotes: z.string().trim().max(2000).optional(),
});

export const adminUserListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    status: z.enum(["ALL", "ACTIVE", "SUSPENDED", "DELETED"]).default("ALL"),
    accountType: z.enum(["ALL", "ADMIN", "STANDARD"]).default("ALL"),
    sort: z.enum(["NEWEST", "OLDEST", "NAME_ASC", "NAME_DESC"]).default("NEWEST"),
});


export const adminCompanyCreateSchema = createCompanySchema;

export const adminCompanyUpdateSchema = updateCompanySchema;

export const adminCompanyListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    status: z.enum(["ALL", "ACTIVE", "SUSPENDED", "DELETED"]).default("ALL"),
    verification: z.enum(["ALL", "VERIFIED", "UNVERIFIED"]).default("ALL"),
    sort: z.enum(["NEWEST", "OLDEST", "NAME_ASC", "NAME_DESC"]).default("NEWEST"),
});


export const adminJobCreateSchema = z.object({
    companyId: z.uuid("A valid company ID is required."),
    job: createJobSchema,
});

export const adminJobUpdateSchema = updateJobSchema;

export const adminJobPublishSchema = z
    .object({
        applicationDeadline: z.coerce.date().optional(),
    })
    .superRefine((value, context) => {
        if (value.applicationDeadline && value.applicationDeadline <= new Date()) {
            context.addIssue({
                code: "custom",
                path: ["applicationDeadline"],
                message: "Application deadline must be in the future.",
            });
        }
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

export type AdminApplicationListQuery = z.infer<typeof adminApplicationListQuerySchema>;
export type AdminApplicationStatusInput = z.infer<typeof adminApplicationStatusSchema>;
export type AdminApplicationShareCreateInput = z.infer<typeof adminApplicationShareCreateSchema>;

export type AdminJobSubmissionListQuery = z.infer<typeof adminJobSubmissionListQuerySchema>;
export type AdminJobSubmissionContactInput = z.infer<typeof adminJobSubmissionContactSchema>;
export type AdminJobSubmissionRejectInput = z.infer<typeof adminJobSubmissionRejectSchema>;
export type AdminJobSubmissionPublishInput = z.infer<typeof adminJobSubmissionPublishSchema>;

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type AdminCompanyCreateInput = z.infer<typeof adminCompanyCreateSchema>;
export type AdminCompanyUpdateInput = z.infer<typeof adminCompanyUpdateSchema>;
export type AdminCompanyListQuery = z.infer<typeof adminCompanyListQuerySchema>;
export type AdminUserSuspensionInput = z.infer<typeof adminUserSuspensionSchema>;
export type AdminCompanySuspensionInput = z.infer<typeof adminCompanySuspensionSchema>;
export type AdminCompanyVerificationInput = z.infer<typeof adminCompanyVerificationSchema>;
export type AdminCategoryListQuery = z.infer<typeof adminCategoryListQuerySchema>;
export type AdminCategoryCreateInput = z.infer<typeof adminCategoryCreateSchema>;
export type AdminCategoryUpdateInput = z.infer<typeof adminCategoryUpdateSchema>;
export type AdminCategoryStatusInput = z.infer<typeof adminCategoryStatusSchema>;
export type AdminJobCreateInput = z.infer<typeof adminJobCreateSchema>;
export type AdminJobUpdateInput = z.infer<typeof adminJobUpdateSchema>;
export type AdminJobPublishInput = z.infer<typeof adminJobPublishSchema>;
export type AdminJobListQuery = z.infer<typeof adminJobListQuerySchema>;
export type AdminJobModerationInput = z.infer<typeof adminJobModerationSchema>;
export type AdminJobReportListQuery = z.infer<typeof adminJobReportListQuerySchema>;
export type AdminJobReportStatusInput = z.infer<typeof adminJobReportStatusSchema>;
export type PlatformActivityQuery = z.infer<typeof platformActivityQuerySchema>;
