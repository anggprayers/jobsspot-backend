import { z } from "zod";

function normalizeOptionalText(value: unknown): unknown {
    if (value === undefined || value === null) {
        return value;
    }

    if (typeof value === "string") {
        const normalizedValue = value.trim();

        return normalizedValue === "" ? null : normalizedValue;
    }

    return value;
}

function normalizeOptionalDate(value: unknown): unknown {
    if (value === undefined || value === null) {
        return value;
    }

    if (value === "") {
        return null;
    }

    return value;
}

const nullableTextSchema = ({
    fieldLabel,
    maxLength,
}: {
    fieldLabel: string;
    maxLength: number;
}) =>
    z.preprocess(
        normalizeOptionalText,
        z
            .string()
            .max(
                maxLength,
                `${fieldLabel} must not exceed ${maxLength.toLocaleString()} characters.`,
            )
            .nullable()
            .optional(),
    );

const nullableUrlSchema = z.preprocess(
    normalizeOptionalText,
    z
        .string()
        .url("Credential URL must be a valid URL.")
        .max(500, "Credential URL must not exceed 500 characters.")
        .nullable()
        .optional(),
);

const nullableDateSchema = z.preprocess(
    normalizeOptionalDate,
    z.union([z.null(), z.coerce.date()]).optional(),
);

const certificationFieldsSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "Certification name is required.")
        .max(150, "Certification name must not exceed 150 characters."),

    issuingOrganization: nullableTextSchema({
        fieldLabel: "Issuing organization",
        maxLength: 150,
    }),

    issueDate: nullableDateSchema,

    expirationDate: nullableDateSchema,

    credentialId: nullableTextSchema({
        fieldLabel: "Credential ID",
        maxLength: 200,
    }),

    credentialUrl: nullableUrlSchema,
});

export const createCertificationSchema = certificationFieldsSchema
    .strict()
    .refine(
        (data) =>
            data.issueDate === null ||
            data.issueDate === undefined ||
            data.expirationDate === null ||
            data.expirationDate === undefined ||
            data.expirationDate >= data.issueDate,
        {
            path: ["expirationDate"],
            message: "Expiration date cannot be earlier than issue date.",
        },
    );

export const updateCertificationSchema = certificationFieldsSchema
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one certification field is required.",
    })
    .refine(
        (data) =>
            data.issueDate === null ||
            data.issueDate === undefined ||
            data.expirationDate === null ||
            data.expirationDate === undefined ||
            data.expirationDate >= data.issueDate,
        {
            path: ["expirationDate"],
            message: "Expiration date cannot be earlier than issue date.",
        },
    );

export type CreateCertificationBody = z.infer<
    typeof createCertificationSchema
>;

export type UpdateCertificationBody = z.infer<
    typeof updateCertificationSchema
>;
