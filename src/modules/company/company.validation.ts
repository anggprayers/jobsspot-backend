import { z } from "zod";

export const createCompanySchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Company name must contain at least 2 characters.")
        .max(100, "Company name cannot exceed 100 characters."),

    description: z.string().trim().max(2000, "Description cannot exceed 2000 characters.").optional(),

    websiteUrl: z.string().trim().url("Website URL must be valid.").optional(),

    industry: z.string().trim().max(100, "Industry cannot exceed 100 characters.").optional(),

    companySize: z.string().trim().max(50, "Company size cannot exceed 50 characters.").optional(),

    location: z.string().trim().max(150, "Location cannot exceed 150 characters.").optional(),
});

export const updateCompanySchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(2, "Company name must contain at least 2 characters.")
            .max(100, "Company name cannot exceed 100 characters.")
            .optional(),

        description: z.string().trim().max(2000, "Description cannot exceed 2000 characters.").nullable().optional(),

        websiteUrl: z.union([z.string().trim().url("Website URL must be valid."), z.literal(""), z.null()]).optional(),

        industry: z.string().trim().max(100, "Industry cannot exceed 100 characters.").nullable().optional(),

        companySize: z.string().trim().max(50, "Company size cannot exceed 50 characters.").nullable().optional(),

        location: z.string().trim().max(150, "Location cannot exceed 150 characters.").nullable().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one company field must be provided.",
    });

export const companyImageTypeSchema = z.enum(["logo", "banner"]);

export const createCompanyUploadUrlSchema = z.object({
    imageType: companyImageTypeSchema,

    fileName: z.string().trim().min(1, "File name is required.").max(255, "File name is too long."),

    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),

    fileSize: z.coerce
        .number()
        .int()
        .positive("File size must be greater than zero.")
        .max(5 * 1024 * 1024, "Image cannot exceed 5 MB."),
});

export const confirmCompanyImageUploadSchema = z.object({
    imageType: companyImageTypeSchema,

    objectKey: z.string().trim().min(1, "Object key is required."),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export type CreateCompanyUploadUrlInput = z.infer<typeof createCompanyUploadUrlSchema>;

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export type ConfirmCompanyImageUploadInput = z.infer<typeof confirmCompanyImageUploadSchema>;

export type CompanyImageType = z.infer<typeof companyImageTypeSchema>;
