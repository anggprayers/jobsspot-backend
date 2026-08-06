import { z } from "zod";

export const adminUuidParamsSchema = z.object({
    userId: z.uuid("A valid user ID is required."),
});

export const adminCompanyUuidParamsSchema = z.object({
    companyId: z.uuid("A valid company ID is required."),
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
export type PlatformActivityQuery = z.infer<typeof platformActivityQuerySchema>;
