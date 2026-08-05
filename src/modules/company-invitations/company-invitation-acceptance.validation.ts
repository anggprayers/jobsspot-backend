import { z } from "zod";

const companyInvitationTokenSchema = z
    .string()
    .trim()
    .regex(
        /^[A-Za-z0-9_-]{43}$/,
        "A valid company invitation token is required.",
    );

export const resolveCompanyInvitationQuerySchema = z.object({
    token: companyInvitationTokenSchema,
});

export const acceptCompanyInvitationSchema = z.object({
    token: companyInvitationTokenSchema,
});

export type ResolveCompanyInvitationQuery = z.infer<
    typeof resolveCompanyInvitationQuerySchema
>;

export type AcceptCompanyInvitationInput = z.infer<
    typeof acceptCompanyInvitationSchema
>;
