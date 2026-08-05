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

const nullableDateSchema = z.preprocess(
    normalizeOptionalDate,
    z.union([z.null(), z.coerce.date()]).optional(),
);

const educationFieldsSchema = z.object({
    institutionName: z
        .string()
        .trim()
        .min(1, "Institution name is required.")
        .max(150, "Institution name must not exceed 150 characters."),

    degree: nullableTextSchema({
        fieldLabel: "Degree",
        maxLength: 150,
    }),

    fieldOfStudy: nullableTextSchema({
        fieldLabel: "Field of study",
        maxLength: 150,
    }),

    startDate: nullableDateSchema,

    endDate: nullableDateSchema,

    isCurrent: z.boolean().default(false),

    description: nullableTextSchema({
        fieldLabel: "Description",
        maxLength: 3000,
    }),
});

export const createEducationSchema = educationFieldsSchema
    .strict()
    .refine(
        (data) =>
            !data.isCurrent ||
            data.endDate === null ||
            data.endDate === undefined,
        {
            path: ["endDate"],
            message: "Current education cannot have an end date.",
        },
    )
    .refine(
        (data) =>
            data.startDate === null ||
            data.startDate === undefined ||
            data.endDate === null ||
            data.endDate === undefined ||
            data.endDate >= data.startDate,
        {
            path: ["endDate"],
            message: "End date cannot be earlier than start date.",
        },
    );

export const updateEducationSchema = educationFieldsSchema
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
        message: "At least one education field is required.",
    })
    .refine(
        (data) =>
            data.isCurrent !== true ||
            data.endDate === null ||
            data.endDate === undefined,
        {
            path: ["endDate"],
            message: "Current education cannot have an end date.",
        },
    )
    .refine(
        (data) =>
            data.startDate === null ||
            data.startDate === undefined ||
            data.endDate === null ||
            data.endDate === undefined ||
            data.endDate >= data.startDate,
        {
            path: ["endDate"],
            message: "End date cannot be earlier than start date.",
        },
    );

export type CreateEducationBody = z.infer<typeof createEducationSchema>;
export type UpdateEducationBody = z.infer<typeof updateEducationSchema>;
