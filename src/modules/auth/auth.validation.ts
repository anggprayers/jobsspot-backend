import { z } from "zod";

function createStrongPasswordSchema(fieldLabel: string) {
    return z
        .string()
        .min(
            8,
            `${fieldLabel} must be at least 8 characters.`,
        )
        .max(
            100,
            `${fieldLabel} must not exceed 100 characters.`,
        )
        .regex(
            /[a-z]/,
            `${fieldLabel} must include at least one lowercase letter.`,
        )
        .regex(
            /[A-Z]/,
            `${fieldLabel} must include at least one uppercase letter.`,
        )
        .regex(
            /[0-9]/,
            `${fieldLabel} must include at least one number.`,
        )
        .regex(
            /[^A-Za-z0-9]/,
            `${fieldLabel} must include at least one special character.`,
        );
}

const registrationPasswordSchema =
    createStrongPasswordSchema("Password");

const newPasswordSchema =
    createStrongPasswordSchema("New password");

export const registerSchema = z
    .object({
        firstName: z
            .string()
            .trim()
            .min(2, "First name must be at least 2 characters.")
            .max(50, "First name must not exceed 50 characters."),

        lastName: z
            .string()
            .trim()
            .min(2, "Last name must be at least 2 characters.")
            .max(50, "Last name must not exceed 50 characters."),

        email: z.email("Invalid email address.").trim().toLowerCase(),

        password: registrationPasswordSchema,

        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        path: ["confirmPassword"],
        message: "Passwords do not match.",
    });

export const loginSchema = z.object({
    email: z.email("Invalid email address.").trim().toLowerCase(),

    password: z.string().min(1, "Password is required.").max(100),
});

const optionalPhoneSchema = z
    .union([
        z
            .string()
            .trim()
            .max(30, "Phone number must not exceed 30 characters.")
            .regex(/^[0-9+\-().\s]*$/, "Phone number contains unsupported characters."),
        z.null(),
    ])
    .transform((value) => {
        if (value === null || value === "") {
            return null;
        }

        return value;
    });

export const updateProfileSchema = z.object({
    firstName: z
        .string()
        .trim()
        .min(2, "First name must be at least 2 characters.")
        .max(50, "First name must not exceed 50 characters."),

    lastName: z
        .string()
        .trim()
        .min(2, "Last name must be at least 2 characters.")
        .max(50, "Last name must not exceed 50 characters."),

    phone: optionalPhoneSchema,
});

export const changePasswordSchema = z
    .object({
        currentPassword: z
            .string()
            .min(1, "Current password is required.")
            .max(100, "Current password must not exceed 100 characters."),

        newPassword: newPasswordSchema,

        confirmNewPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmNewPassword, {
        path: ["confirmNewPassword"],
        message: "New passwords do not match.",
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
        path: ["newPassword"],
        message: "New password must be different from the current password.",
    });

export const verifyEmailSchema = z
    .object({
        token: z
            .string()
            .trim()
            .min(
                40,
                "The verification token is invalid.",
            )
            .max(
                512,
                "The verification token is invalid.",
            ),
    })
    .strict();


export const forgotPasswordSchema = z
    .object({
        email: z
            .email(
                "A valid email address is required.",
            )
            .trim()
            .toLowerCase(),
    })
    .strict();

export const resetPasswordSchema = z
    .object({
        token: z
            .string()
            .trim()
            .min(
                40,
                "The password reset token is invalid.",
            )
            .max(
                512,
                "The password reset token is invalid.",
            ),

        newPassword:
            createStrongPasswordSchema(
                "New password",
            ),

        confirmNewPassword: z.string(),
    })
    .strict()
    .refine(
        (data) =>
            data.newPassword ===
            data.confirmNewPassword,
        {
            path: [
                "confirmNewPassword",
            ],
            message:
                "New passwords do not match.",
        },
    );


export const googleLoginSchema = z
    .object({
        credential: z
            .string()
            .trim()
            .min(
                100,
                "A valid Google credential is required.",
            )
            .max(
                8_192,
                "The Google credential is invalid.",
            ),
    })
    .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
