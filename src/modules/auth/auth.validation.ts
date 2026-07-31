import { z } from "zod";

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

        password: z
            .string()
            .min(8, "Password must be at least 8 characters.")
            .max(100, "Password must not exceed 100 characters."),

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

        newPassword: z
            .string()
            .min(8, "New password must be at least 8 characters.")
            .max(100, "New password must not exceed 100 characters."),

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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
