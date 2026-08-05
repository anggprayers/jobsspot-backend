import { z } from "zod";

import { CompanyMemberRole } from "../../generated/prisma/client.js";

const assignableInvitationRoles = [
    CompanyMemberRole.ADMIN,
    CompanyMemberRole.RECRUITER,
    CompanyMemberRole.VIEWER,
] as const;

export const createCompanyInvitationSchema = z.object({
    email: z
        .email("A valid email address is required.")
        .trim()
        .toLowerCase(),

    role: z.enum(assignableInvitationRoles),
});

export const companyInvitationCompanyParamsSchema = z.object({
    companyId: z.uuid(
        "A valid company ID is required.",
    ),
});

export const companyInvitationResourceParamsSchema =
    companyInvitationCompanyParamsSchema.extend({
        invitationId: z.uuid(
            "A valid invitation ID is required.",
        ),
    });

export type CreateCompanyInvitationInput = z.infer<
    typeof createCompanyInvitationSchema
>;
