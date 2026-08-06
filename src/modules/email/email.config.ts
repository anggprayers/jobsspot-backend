import { z } from "zod";

const emailEnvironmentSchema = z.object({
    RESEND_API_KEY: z
        .string()
        .trim()
        .min(1, "RESEND_API_KEY is required."),

    EMAIL_FROM: z
        .string()
        .trim()
        .min(1, "EMAIL_FROM is required."),

    EMAIL_REPLY_TO: z
        .email("EMAIL_REPLY_TO must be a valid email address.")
        .trim()
        .toLowerCase(),

    CONTACT_INBOX_EMAIL: z.preprocess(
        (value) =>
            typeof value === "string" && value.trim() === ""
                ? undefined
                : value,
        z
            .email(
                "CONTACT_INBOX_EMAIL must be a valid email address.",
            )
            .trim()
            .toLowerCase()
            .optional(),
    ),

    EMAIL_LOGO_URL: z
        .string()
        .trim()
        .url("EMAIL_LOGO_URL must be a valid URL.")
        .refine(
            (value: string) => value.startsWith("https://"),
            "EMAIL_LOGO_URL must use HTTPS.",
        )
        .optional(),

    FRONTEND_URL: z
        .url("FRONTEND_URL must be a valid URL.")
        .transform((value: string) => value.replace(/\/+$/, "")),

    EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: z.coerce
        .number()
        .int()
        .min(5)
        .max(1_440)
        .default(30),

    PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce
        .number()
        .int()
        .min(5)
        .max(1_440)
        .default(30),

    COMPANY_INVITATION_TOKEN_TTL_DAYS: z.coerce
        .number()
        .int()
        .min(1)
        .max(30)
        .default(7),

    COMPANY_INVITATION_RESEND_COOLDOWN_MINUTES: z.coerce
        .number()
        .int()
        .min(1)
        .max(1_440)
        .default(15),

    COMPANY_INVITATION_RECIPIENT_DAILY_LIMIT: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .default(3),

    COMPANY_INVITATION_COMPANY_DAILY_LIMIT: z.coerce
        .number()
        .int()
        .min(1)
        .max(10_000)
        .default(50),
});

const result = emailEnvironmentSchema.safeParse(
    process.env,
);

if (!result.success) {
    console.error(
        "Invalid JobsSpot email configuration:",
        result.error.flatten().fieldErrors,
    );

    throw new Error(
        "JobsSpot email environment variables are invalid.",
    );
}

export const emailConfig = {
    resendApiKey: result.data.RESEND_API_KEY,
    from: result.data.EMAIL_FROM,
    replyTo: result.data.EMAIL_REPLY_TO,
    contactInbox:
        result.data.CONTACT_INBOX_EMAIL ??
        result.data.EMAIL_REPLY_TO,
    logoUrl: result.data.EMAIL_LOGO_URL ?? null,
    frontendUrl: result.data.FRONTEND_URL,
    verificationTokenTtlMinutes:
        result.data
            .EMAIL_VERIFICATION_TOKEN_TTL_MINUTES,
    passwordResetTokenTtlMinutes:
        result.data.PASSWORD_RESET_TOKEN_TTL_MINUTES,
    companyInvitationTokenTtlDays:
        result.data.COMPANY_INVITATION_TOKEN_TTL_DAYS,
    companyInvitationResendCooldownMinutes:
        result.data
            .COMPANY_INVITATION_RESEND_COOLDOWN_MINUTES,
    companyInvitationRecipientDailyLimit:
        result.data
            .COMPANY_INVITATION_RECIPIENT_DAILY_LIMIT,
    companyInvitationCompanyDailyLimit:
        result.data
            .COMPANY_INVITATION_COMPANY_DAILY_LIMIT,
} as const;
