import { z } from "zod";

import { CompanyMemberRole } from "../../generated/prisma/client.js";

const assignableCompanyRoles = [
    CompanyMemberRole.ADMIN,
    CompanyMemberRole.RECRUITER,
    CompanyMemberRole.VIEWER,
] as const;

export const addCompanyMemberSchema = z.object({
    email: z.email("A valid email address is required.").trim().toLowerCase(),

    role: z.enum(assignableCompanyRoles),
});

export const updateCompanyMemberRoleSchema = z.object({
    role: z.enum(assignableCompanyRoles),
});

export const searchCompanyMemberCandidatesSchema = z.object({
    query: z
        .string()
        .trim()
        .min(3, "Enter at least 3 characters to search.")
        .max(100, "Search must not exceed 100 characters."),
});

export type AddCompanyMemberInput = z.infer<typeof addCompanyMemberSchema>;

export type UpdateCompanyMemberRoleInput = z.infer<typeof updateCompanyMemberRoleSchema>;

export type SearchCompanyMemberCandidatesInput = z.infer<typeof searchCompanyMemberCandidatesSchema>;
