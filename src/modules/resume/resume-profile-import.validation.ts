import { z } from "zod";

const optionalText = (max: number) =>
    z.union([z.string().trim().max(max), z.null()]).optional();

const optionalUrl = z
    .union([
        z.string().trim().url("Enter a valid URL.").max(500),
        z.null(),
    ])
    .optional();

const optionalDate = z
    .union([
        z.string().datetime({ offset: true }),
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        z.null(),
    ])
    .optional();

const workExperienceImportSchema = z
    .object({
        jobTitle: z.string().trim().min(1).max(120),
        companyName: z.string().trim().min(1).max(120),
        location: optionalText(120),
        startDate: z.union([
            z.string().datetime({ offset: true }),
            z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        ]),
        endDate: optionalDate,
        isCurrent: z.boolean().default(false),
        description: optionalText(3000),
    })
    .strict();

const educationImportSchema = z
    .object({
        institutionName: z.string().trim().min(1).max(150),
        degree: optionalText(150),
        fieldOfStudy: optionalText(150),
        startDate: optionalDate,
        endDate: optionalDate,
        isCurrent: z.boolean().default(false),
        description: optionalText(3000),
    })
    .strict();

const certificationImportSchema = z
    .object({
        name: z.string().trim().min(1).max(150),
        issuingOrganization: optionalText(150),
        issueDate: optionalDate,
        expirationDate: optionalDate,
        credentialId: optionalText(200),
        credentialUrl: optionalUrl,
    })
    .strict();

export const importResumeProfileSchema = z
    .object({
        personal: z
            .object({
                firstName: optionalText(50),
                lastName: optionalText(50),
                phone: optionalText(30),
                location: optionalText(120),
            })
            .strict()
            .optional(),
        professional: z
            .object({
                headline: optionalText(120),
                summary: optionalText(2000),
                websiteUrl: optionalUrl,
                linkedInUrl: optionalUrl,
                yearsOfExperience: z.number().int().min(0).max(60).nullable().optional(),
            })
            .strict()
            .optional(),
        skills: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
        workExperiences: z.array(workExperienceImportSchema).max(15).optional(),
        education: z.array(educationImportSchema).max(10).optional(),
        certifications: z.array(certificationImportSchema).max(15).optional(),
    })
    .strict()
    .refine(
        (data) =>
            Boolean(data.personal) ||
            Boolean(data.professional) ||
            Boolean(data.skills?.length) ||
            Boolean(data.workExperiences?.length) ||
            Boolean(data.education?.length) ||
            Boolean(data.certifications?.length),
        {
            message: "Select at least one detected profile item to import.",
        },
    );

export type ImportResumeProfileBody = z.infer<typeof importResumeProfileSchema>;
