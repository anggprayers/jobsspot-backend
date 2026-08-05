import { z } from "zod";

import {
    EmploymentType,
    ExperienceLevel,
    SalaryPeriod,
    WorkplaceType,
} from "../../generated/prisma/client.js";

const allowedPublishedWithinDays = [
    1,
    3,
    7,
    14,
    30,
] as const;

function hasOwnField(
    value: object,
    field: string,
): boolean {
    return Object.prototype.hasOwnProperty.call(
        value,
        field,
    );
}

function normalizeOptionalText(value: unknown): unknown {
    if (value === undefined || value === null) {
        return value;
    }

    if (typeof value === "string") {
        const normalizedValue = value.trim();

        return normalizedValue === ""
            ? null
            : normalizedValue;
    }

    return value;
}

function normalizeOptionalNumber(value: unknown): unknown {
    if (value === undefined || value === null) {
        return value;
    }

    if (value === "") {
        return null;
    }

    if (typeof value === "string") {
        const normalizedValue = value.trim();

        if (normalizedValue === "") {
            return null;
        }

        return Number(normalizedValue);
    }

    return value;
}

function normalizeOptionalArray(value: unknown): unknown {
    if (value === undefined || value === null) {
        return value;
    }

    const values = Array.isArray(value)
        ? value
        : [value];

    return values
        .flatMap((item) =>
            typeof item === "string"
                ? item.split(",")
                : [item],
        )
        .map((item) =>
            typeof item === "string"
                ? item.trim()
                : item,
        )
        .filter((item) => item !== "");
}

function uniqueValues<T>(values: T[]): T[] {
    return [...new Set(values)];
}

const nullableKeywordSchema = z.preprocess(
    normalizeOptionalText,
    z
        .string()
        .max(
            200,
            "Keyword must not exceed 200 characters.",
        )
        .nullable()
        .optional(),
);

const nullableLocationSchema = z.preprocess(
    normalizeOptionalText,
    z
        .string()
        .max(
            150,
            "Location must not exceed 150 characters.",
        )
        .nullable()
        .optional(),
);

const nullableCategorySlugSchema = z.preprocess(
    normalizeOptionalText,
    z
        .string()
        .max(
            160,
            "Category slug must not exceed 160 characters.",
        )
        .nullable()
        .optional(),
);

const nullableCategorySlugsSchema = z.preprocess(
    normalizeOptionalArray,
    z
        .array(
            z
                .string()
                .trim()
                .min(1, "Category slug cannot be empty.")
                .max(
                    160,
                    "Category slug must not exceed 160 characters.",
                ),
        )
        .max(
            20,
            "A maximum of 20 categories can be saved.",
        )
        .transform(uniqueValues)
        .nullable()
        .optional(),
);

const nullableEmploymentTypesSchema = z.preprocess(
    normalizeOptionalArray,
    z
        .array(z.enum(EmploymentType))
        .max(
            Object.values(EmploymentType).length,
            "Too many employment types were provided.",
        )
        .transform(uniqueValues)
        .nullable()
        .optional(),
);

const nullableWorkplaceTypesSchema = z.preprocess(
    normalizeOptionalArray,
    z
        .array(z.enum(WorkplaceType))
        .max(
            Object.values(WorkplaceType).length,
            "Too many workplace types were provided.",
        )
        .transform(uniqueValues)
        .nullable()
        .optional(),
);

const nullableExperienceLevelsSchema = z.preprocess(
    normalizeOptionalArray,
    z
        .array(z.enum(ExperienceLevel))
        .max(
            Object.values(ExperienceLevel).length,
            "Too many experience levels were provided.",
        )
        .transform(uniqueValues)
        .nullable()
        .optional(),
);

const nullableSalarySchema = z.preprocess(
    normalizeOptionalNumber,
    z
        .number()
        .finite("Salary must be a valid number.")
        .min(0, "Salary cannot be negative.")
        .max(
            9_999_999_999.99,
            "Salary exceeds the supported maximum.",
        )
        .nullable()
        .optional(),
);

const nullableSalaryCurrencySchema = z.preprocess(
    normalizeOptionalText,
    z
        .string()
        .length(
            3,
            "Salary currency must be a three-letter code.",
        )
        .regex(
            /^[A-Za-z]{3}$/,
            "Salary currency must be a valid three-letter code.",
        )
        .transform((value) => value.toUpperCase())
        .nullable()
        .optional(),
);

const nullablePublishedWithinDaysSchema = z.preprocess(
    normalizeOptionalNumber,
    z
        .number()
        .int(
            "Listing time must be a whole number of days.",
        )
        .refine(
            (value) =>
                allowedPublishedWithinDays.includes(
                    value as (typeof allowedPublishedWithinDays)[number],
                ),
            {
                message:
                    "Listing time must be 1, 3, 7, 14, or 30 days.",
            },
        )
        .nullable()
        .optional(),
);

const savedSearchFieldsSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(
                1,
                "Saved search name is required.",
            )
            .max(
                100,
                "Saved search name must not exceed 100 characters.",
            ),

        keyword: nullableKeywordSchema,
        location: nullableLocationSchema,

        // Legacy singular category inputs remain accepted.
        categoryId: z.uuid().nullable().optional(),
        categorySlug: nullableCategorySlugSchema,
        categorySlugs: nullableCategorySlugsSchema,

        // Legacy singular enum inputs remain accepted.
        employmentType: z
            .enum(EmploymentType)
            .nullable()
            .optional(),
        employmentTypes: nullableEmploymentTypesSchema,

        workplaceType: z
            .enum(WorkplaceType)
            .nullable()
            .optional(),
        workplaceTypes: nullableWorkplaceTypesSchema,

        experienceLevel: z
            .enum(ExperienceLevel)
            .nullable()
            .optional(),
        experienceLevels: nullableExperienceLevelsSchema,

        salaryMin: nullableSalarySchema,
        salaryMax: nullableSalarySchema,
        salaryCurrency: nullableSalaryCurrencySchema,
        salaryPeriod: z
            .enum(SalaryPeriod)
            .nullable()
            .optional(),

        publishedWithinDays:
            nullablePublishedWithinDaysSchema,
    })
    .strict();

function hasConflictingFields(
    data: object,
    singularFields: string[],
    pluralField: string,
): boolean {
    return (
        hasOwnField(data, pluralField) &&
        singularFields.some((field) =>
            hasOwnField(data, field),
        )
    );
}

function hasInvalidSalaryRange(data: {
    salaryMin?: number | null | undefined;
    salaryMax?: number | null | undefined;
}): boolean {
    return (
        data.salaryMin !== undefined &&
        data.salaryMin !== null &&
        data.salaryMax !== undefined &&
        data.salaryMax !== null &&
        data.salaryMax < data.salaryMin
    );
}

function hasSalaryWithoutPeriod(data: {
    salaryMin?: number | null | undefined;
    salaryMax?: number | null | undefined;
    salaryPeriod?: SalaryPeriod | null | undefined;
}): boolean {
    const hasSalary =
        (data.salaryMin !== undefined &&
            data.salaryMin !== null) ||
        (data.salaryMax !== undefined &&
            data.salaryMax !== null);

    return hasSalary && !data.salaryPeriod;
}

function addSharedIssues(
    data: z.infer<typeof savedSearchFieldsSchema>,
    context: z.RefinementCtx,
): void {
    if (
        hasConflictingFields(
            data,
            ["categoryId", "categorySlug"],
            "categorySlugs",
        )
    ) {
        context.addIssue({
            code: "custom",
            path: ["categorySlugs"],
            message:
                "Provide singular or plural category fields, not both.",
        });
    }

    if (
        hasConflictingFields(
            data,
            ["employmentType"],
            "employmentTypes",
        )
    ) {
        context.addIssue({
            code: "custom",
            path: ["employmentTypes"],
            message:
                "Provide employmentType or employmentTypes, not both.",
        });
    }

    if (
        hasConflictingFields(
            data,
            ["workplaceType"],
            "workplaceTypes",
        )
    ) {
        context.addIssue({
            code: "custom",
            path: ["workplaceTypes"],
            message:
                "Provide workplaceType or workplaceTypes, not both.",
        });
    }

    if (
        hasConflictingFields(
            data,
            ["experienceLevel"],
            "experienceLevels",
        )
    ) {
        context.addIssue({
            code: "custom",
            path: ["experienceLevels"],
            message:
                "Provide experienceLevel or experienceLevels, not both.",
        });
    }

    if (hasInvalidSalaryRange(data)) {
        context.addIssue({
            code: "custom",
            path: ["salaryMax"],
            message:
                "Maximum salary cannot be lower than minimum salary.",
        });
    }
}

function hasActiveSearchFilter(
    data: z.infer<typeof savedSearchFieldsSchema>,
): boolean {
    return Boolean(
        data.keyword ||
            data.location ||
            data.categoryId ||
            data.categorySlug ||
            (data.categorySlugs?.length ?? 0) > 0 ||
            data.employmentType ||
            (data.employmentTypes?.length ?? 0) > 0 ||
            data.workplaceType ||
            (data.workplaceTypes?.length ?? 0) > 0 ||
            data.experienceLevel ||
            (data.experienceLevels?.length ?? 0) > 0 ||
            (data.salaryMin !== null &&
                data.salaryMin !== undefined) ||
            (data.salaryMax !== null &&
                data.salaryMax !== undefined) ||
            data.publishedWithinDays,
    );
}

export const createSavedSearchSchema =
    savedSearchFieldsSchema.superRefine(
        (data, context) => {
            addSharedIssues(data, context);

            if (hasSalaryWithoutPeriod(data)) {
                context.addIssue({
                    code: "custom",
                    path: ["salaryPeriod"],
                    message:
                        "Salary period is required when saving a salary range.",
                });
            }

            if (!hasActiveSearchFilter(data)) {
                context.addIssue({
                    code: "custom",
                    path: ["name"],
                    message:
                        "Choose at least one search term or filter before saving.",
                });
            }
        },
    );

export const updateSavedSearchSchema =
    savedSearchFieldsSchema
        .partial()
        .superRefine((data, context) => {
            if (Object.keys(data).length === 0) {
                context.addIssue({
                    code: "custom",
                    message:
                        "At least one saved search field is required.",
                });
            }

            addSharedIssues(
                data as z.infer<
                    typeof savedSearchFieldsSchema
                >,
                context,
            );
        });

export const savedSearchesQuerySchema = z
    .object({
        page: z.coerce
            .number()
            .int("Page must be a whole number.")
            .positive(
                "Page must be greater than zero.",
            )
            .default(1),

        limit: z.coerce
            .number()
            .int("Limit must be a whole number.")
            .min(1, "Limit must be at least 1.")
            .max(50, "Limit cannot exceed 50.")
            .default(10),
    })
    .strict();

export type CreateSavedSearchBody = z.infer<
    typeof createSavedSearchSchema
>;

export type UpdateSavedSearchBody = z.infer<
    typeof updateSavedSearchSchema
>;

export type SavedSearchesQuery = z.infer<
    typeof savedSearchesQuerySchema
>;
