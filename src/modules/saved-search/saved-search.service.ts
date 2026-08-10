import { Prisma } from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import type {
    CreateSavedSearchBody,
    SavedSearchesQuery,
    UpdateSavedSearchBody,
} from "./saved-search.validation.js";

const MAX_SAVED_SEARCHES_PER_USER = 50;

const savedSearchSelect = {
    id: true,
    name: true,
    keyword: true,
    location: true,

    categoryId: true,
    categorySlugs: true,

    employmentType: true,
    employmentTypes: true,
    workplaceType: true,
    workplaceTypes: true,
    experienceLevel: true,
    experienceLevels: true,

    salaryMin: true,
    salaryMax: true,
    salaryCurrency: true,
    salaryPeriod: true,
    publishedWithinDays: true,

    emailAlertsEnabled: true,
    alertFrequency: true,
    lastAlertSentAt: true,
    createdAt: true,
    updatedAt: true,

    category: {
        select: {
            id: true,
            name: true,
            slug: true,
        },
    },
} satisfies Prisma.SavedSearchSelect;

const ownedSavedSearchSelect = {
    ...savedSearchSelect,
    userId: true,
    deletedAt: true,
} satisfies Prisma.SavedSearchSelect;

type RawSavedSearch = Prisma.SavedSearchGetPayload<{
    select: typeof savedSearchSelect;
}>;

type OwnedSavedSearch =
    Prisma.SavedSearchGetPayload<{
        select: typeof ownedSavedSearchSelect;
    }>;

type CreateUserSavedSearchInput = {
    userId: string;
    data: CreateSavedSearchBody;
};

type UpdateUserSavedSearchInput = {
    userId: string;
    savedSearchId: string;
    data: UpdateSavedSearchBody;
};

type DeleteUserSavedSearchInput = {
    userId: string;
    savedSearchId: string;
};

function hasOwnField(
    value: object,
    field: string,
): boolean {
    return Object.prototype.hasOwnProperty.call(
        value,
        field,
    );
}

const ALERT_FILTER_FIELDS = [
    "keyword",
    "location",
    "categoryId",
    "categorySlug",
    "categorySlugs",
    "employmentType",
    "employmentTypes",
    "workplaceType",
    "workplaceTypes",
    "experienceLevel",
    "experienceLevels",
    "salaryMin",
    "salaryMax",
    "salaryCurrency",
    "salaryPeriod",
    "publishedWithinDays",
] as const;

function hasSavedSearchFilterChanges(data: UpdateSavedSearchBody): boolean {
    return ALERT_FILTER_FIELDS.some((field) => hasOwnField(data, field));
}

async function ensureUserCanReceiveSavedSearchAlerts(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            isEmailVerified: true,
            deletedAt: true,
            suspendedAt: true,
        },
    });

    if (!user || user.deletedAt || user.suspendedAt) {
        throw new AppError(403, "This account cannot enable job alerts.");
    }

    if (!user.isEmailVerified) {
        throw new AppError(409, "Verify your email address before enabling job alerts.");
    }
}

function toNullableNumber(
    value: Prisma.Decimal | null,
): number | null {
    return value === null ? null : Number(value);
}

function uniqueValues<T>(values: T[]): T[] {
    return [...new Set(values)];
}

function getSingleValueOrNull<T>(
    values: readonly T[],
): T | null {
    if (values.length !== 1) {
        return null;
    }

    // The length guard guarantees that index 0 exists.
    return values[0]!;
}

async function findOwnedSavedSearch(
    userId: string,
    savedSearchId: string,
): Promise<OwnedSavedSearch> {
    const savedSearch =
        await prisma.savedSearch.findFirst({
            where: {
                id: savedSearchId,
                userId,
                deletedAt: null,
            },
            select: ownedSavedSearchSelect,
        });

    if (!savedSearch) {
        throw new AppError(
            404,
            "Saved search not found.",
        );
    }

    return savedSearch;
}

async function ensureUniqueSavedSearchName({
    userId,
    name,
    excludeSavedSearchId,
}: {
    userId: string;
    name: string;
    excludeSavedSearchId?: string;
}): Promise<void> {
    const duplicate =
        await prisma.savedSearch.findFirst({
            where: {
                userId,
                deletedAt: null,
                name: {
                    equals: name,
                    mode: "insensitive",
                },
                ...(excludeSavedSearchId && {
                    id: {
                        not: excludeSavedSearchId,
                    },
                }),
            },
            select: {
                id: true,
            },
        });

    if (duplicate) {
        throw new AppError(
            409,
            "You already have an active saved search with this name.",
        );
    }
}

async function resolveCategorySelection(
    data: {
        categoryId?: string | null | undefined;
        categorySlug?: string | null | undefined;
        categorySlugs?: string[] | null | undefined;
    },
): Promise<
    | {
          categorySlugs: string[];
          categoryId: string | null;
      }
    | undefined
> {
    const pluralProvided = hasOwnField(
        data,
        "categorySlugs",
    );
    const singularProvided =
        hasOwnField(data, "categoryId") ||
        hasOwnField(data, "categorySlug");

    if (!pluralProvided && !singularProvided) {
        return undefined;
    }

    if (pluralProvided && singularProvided) {
        throw new AppError(
            400,
            "Provide singular or plural category fields, not both.",
        );
    }

    let requestedSlugs: string[] = [];

    if (pluralProvided) {
        requestedSlugs = uniqueValues(
            data.categorySlugs ?? [],
        );
    } else if (data.categoryId) {
        const category =
            await prisma.jobCategory.findUnique({
                where: {
                    id: data.categoryId,
                },
                select: {
                    id: true,
                    slug: true,
                },
            });

        if (!category) {
            throw new AppError(
                400,
                "Selected job category does not exist.",
            );
        }

        return {
            categorySlugs: [category.slug],
            categoryId: category.id,
        };
    } else if (data.categorySlug) {
        requestedSlugs = [data.categorySlug];
    }

    if (requestedSlugs.length === 0) {
        return {
            categorySlugs: [],
            categoryId: null,
        };
    }

    const categories =
        await prisma.jobCategory.findMany({
            where: {
                slug: {
                    in: requestedSlugs,
                },
            },
            select: {
                id: true,
                slug: true,
            },
        });

    if (categories.length !== requestedSlugs.length) {
        throw new AppError(
            400,
            "One or more selected job categories do not exist.",
        );
    }

    const categoryBySlug = new Map(
        categories.map((category) => [
            category.slug,
            category,
        ]),
    );

    const normalizedSlugs = requestedSlugs.filter(
        (slug) => categoryBySlug.has(slug),
    );

    return {
        categorySlugs: normalizedSlugs,
        categoryId:
            normalizedSlugs.length === 1
                ? categoryBySlug.get(
                      normalizedSlugs[0] ?? "",
                  )?.id ?? null
                : null,
    };
}

function getEmploymentTypes(
    data: {
        employmentType?: CreateSavedSearchBody["employmentType"];
        employmentTypes?: CreateSavedSearchBody["employmentTypes"];
    },
): NonNullable<CreateSavedSearchBody["employmentTypes"]> {
    if (data.employmentTypes !== undefined) {
        return uniqueValues(
            data.employmentTypes ?? [],
        );
    }

    return data.employmentType
        ? [data.employmentType]
        : [];
}

function getWorkplaceTypes(
    data: {
        workplaceType?: CreateSavedSearchBody["workplaceType"];
        workplaceTypes?: CreateSavedSearchBody["workplaceTypes"];
    },
): NonNullable<CreateSavedSearchBody["workplaceTypes"]> {
    if (data.workplaceTypes !== undefined) {
        return uniqueValues(
            data.workplaceTypes ?? [],
        );
    }

    return data.workplaceType
        ? [data.workplaceType]
        : [];
}

function getExperienceLevels(
    data: {
        experienceLevel?: CreateSavedSearchBody["experienceLevel"];
        experienceLevels?: CreateSavedSearchBody["experienceLevels"];
    },
): NonNullable<CreateSavedSearchBody["experienceLevels"]> {
    if (data.experienceLevels !== undefined) {
        return uniqueValues(
            data.experienceLevels ?? [],
        );
    }

    return data.experienceLevel
        ? [data.experienceLevel]
        : [];
}

function validateSalaryFilter({
    salaryMin,
    salaryMax,
    salaryPeriod,
}: {
    salaryMin: number | null;
    salaryMax: number | null;
    salaryPeriod:
        | CreateSavedSearchBody["salaryPeriod"]
        | null;
}): void {
    if (
        salaryMin !== null &&
        salaryMax !== null &&
        salaryMax < salaryMin
    ) {
        throw new AppError(
            400,
            "Maximum salary cannot be lower than minimum salary.",
        );
    }

    if (
        (salaryMin !== null || salaryMax !== null) &&
        !salaryPeriod
    ) {
        throw new AppError(
            400,
            "Salary period is required when saving a salary range.",
        );
    }
}

function resolveSalaryCurrency({
    salaryMin,
    salaryMax,
    salaryCurrency,
}: {
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string | null;
}): string | null {
    const hasSalary =
        salaryMin !== null || salaryMax !== null;

    if (!hasSalary) {
        return null;
    }

    return salaryCurrency ?? "USD";
}

async function hydrateSavedSearches(
    savedSearches: RawSavedSearch[],
) {
    const allCategorySlugs = uniqueValues(
        savedSearches.flatMap((savedSearch) => {
            if (savedSearch.categorySlugs.length > 0) {
                return savedSearch.categorySlugs;
            }

            return savedSearch.category
                ? [savedSearch.category.slug]
                : [];
        }),
    );

    const categories =
        allCategorySlugs.length > 0
            ? await prisma.jobCategory.findMany({
                  where: {
                      slug: {
                          in: allCategorySlugs,
                      },
                  },
                  select: {
                      id: true,
                      name: true,
                      slug: true,
                  },
              })
            : [];

    const categoryBySlug = new Map(
        categories.map((category) => [
            category.slug,
            category,
        ]),
    );

    return savedSearches.map((savedSearch) => {
        const categorySlugs =
            savedSearch.categorySlugs.length > 0
                ? savedSearch.categorySlugs
                : savedSearch.category
                  ? [savedSearch.category.slug]
                  : [];

        const resolvedCategories =
            categorySlugs.flatMap((slug) => {
                const category =
                    categoryBySlug.get(slug);

                return category ? [category] : [];
            });

        const employmentTypes =
            savedSearch.employmentTypes.length > 0
                ? savedSearch.employmentTypes
                : savedSearch.employmentType
                  ? [savedSearch.employmentType]
                  : [];

        const workplaceTypes =
            savedSearch.workplaceTypes.length > 0
                ? savedSearch.workplaceTypes
                : savedSearch.workplaceType
                  ? [savedSearch.workplaceType]
                  : [];

        const experienceLevels =
            savedSearch.experienceLevels.length > 0
                ? savedSearch.experienceLevels
                : savedSearch.experienceLevel
                  ? [savedSearch.experienceLevel]
                  : [];

        return {
            ...savedSearch,
            categorySlugs,
            categories: resolvedCategories,
            category:
                resolvedCategories[0] ??
                savedSearch.category,
            employmentTypes,
            workplaceTypes,
            experienceLevels,
        };
    });
}

async function hydrateSavedSearch(
    savedSearch: RawSavedSearch,
) {
    const hydrated = await hydrateSavedSearches([
        savedSearch,
    ]);
    const result = hydrated[0];

    if (!result) {
        throw new AppError(
            500,
            "Unable to prepare the saved search response.",
        );
    }

    return result;
}

export async function listUserSavedSearches({
    userId,
    page,
    limit,
}: SavedSearchesQuery & {
    userId: string;
}) {
    const skip = (page - 1) * limit;

    const where: Prisma.SavedSearchWhereInput = {
        userId,
        deletedAt: null,
    };

    const [rawSavedSearches, totalItems] =
        await Promise.all([
            prisma.savedSearch.findMany({
                where,
                select: savedSearchSelect,
                orderBy: [
                    {
                        updatedAt: "desc",
                    },
                    {
                        createdAt: "desc",
                    },
                ],
                skip,
                take: limit,
            }),
            prisma.savedSearch.count({
                where,
            }),
        ]);

    const savedSearches =
        await hydrateSavedSearches(
            rawSavedSearches,
        );

    const totalPages = Math.max(
        1,
        Math.ceil(totalItems / limit),
    );

    return {
        savedSearches,
        pagination: {
            page,
            limit,
            totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        },
    };
}

export async function createUserSavedSearch({
    userId,
    data,
}: CreateUserSavedSearchInput) {
    const activeSavedSearchCount =
        await prisma.savedSearch.count({
            where: {
                userId,
                deletedAt: null,
            },
        });

    if (
        activeSavedSearchCount >=
        MAX_SAVED_SEARCHES_PER_USER
    ) {
        throw new AppError(
            409,
            `You can save up to ${MAX_SAVED_SEARCHES_PER_USER} searches.`,
        );
    }

    await ensureUniqueSavedSearchName({
        userId,
        name: data.name,
    });

    const categorySelection =
        (await resolveCategorySelection(data)) ?? {
            categorySlugs: [],
            categoryId: null,
        };

    const employmentTypes =
        getEmploymentTypes(data);
    const workplaceTypes =
        getWorkplaceTypes(data);
    const experienceLevels =
        getExperienceLevels(data);

    const salaryMin = data.salaryMin ?? null;
    const salaryMax = data.salaryMax ?? null;
    const salaryPeriod =
        data.salaryPeriod ?? null;

    validateSalaryFilter({
        salaryMin,
        salaryMax,
        salaryPeriod,
    });

    const salaryCurrency =
        resolveSalaryCurrency({
            salaryMin,
            salaryMax,
            salaryCurrency:
                data.salaryCurrency ?? null,
        });

    const emailAlertsEnabled =
        data.emailAlertsEnabled ?? false;
    const alertFrequency = emailAlertsEnabled
        ? (data.alertFrequency ?? null)
        : null;

    if (emailAlertsEnabled && !alertFrequency) {
        throw new AppError(
            400,
            "Choose a daily or weekly frequency when enabling job alerts.",
        );
    }

    if (emailAlertsEnabled) {
        await ensureUserCanReceiveSavedSearchAlerts(userId);
    }

    const alertAnchor = emailAlertsEnabled
        ? new Date()
        : null;

    const rawSavedSearch =
        await prisma.savedSearch.create({
            data: {
                userId,
                name: data.name,
                keyword: data.keyword ?? null,
                location: data.location ?? null,

                categoryId:
                    categorySelection.categoryId,
                categorySlugs:
                    categorySelection.categorySlugs,

                employmentType:
                    getSingleValueOrNull(
                        employmentTypes,
                    ),
                employmentTypes,

                workplaceType:
                    getSingleValueOrNull(
                        workplaceTypes,
                    ),
                workplaceTypes,

                experienceLevel:
                    getSingleValueOrNull(
                        experienceLevels,
                    ),
                experienceLevels,

                salaryMin,
                salaryMax,
                salaryCurrency,
                salaryPeriod:
                    salaryMin !== null ||
                    salaryMax !== null
                        ? salaryPeriod
                        : null,
                publishedWithinDays:
                    data.publishedWithinDays ?? null,

                emailAlertsEnabled,
                alertFrequency,
                lastAlertSentAt: alertAnchor,
            },
            select: savedSearchSelect,
        });

    return hydrateSavedSearch(rawSavedSearch);
}

export async function updateUserSavedSearch({
    userId,
    savedSearchId,
    data,
}: UpdateUserSavedSearchInput) {
    const existingSavedSearch =
        await findOwnedSavedSearch(
            userId,
            savedSearchId,
        );

    const nextName =
        data.name ?? existingSavedSearch.name;

    if (
        nextName.toLocaleLowerCase() !==
        existingSavedSearch.name.toLocaleLowerCase()
    ) {
        await ensureUniqueSavedSearchName({
            userId,
            name: nextName,
            excludeSavedSearchId: savedSearchId,
        });
    }

    const categorySelection =
        await resolveCategorySelection(data);

    const employmentSelectionProvided =
        hasOwnField(data, "employmentTypes") ||
        hasOwnField(data, "employmentType");
    const workplaceSelectionProvided =
        hasOwnField(data, "workplaceTypes") ||
        hasOwnField(data, "workplaceType");
    const experienceSelectionProvided =
        hasOwnField(data, "experienceLevels") ||
        hasOwnField(data, "experienceLevel");

    const nextEmploymentTypes =
        employmentSelectionProvided
            ? getEmploymentTypes(data)
            : existingSavedSearch.employmentTypes
                  .length > 0
              ? existingSavedSearch.employmentTypes
              : existingSavedSearch.employmentType
                ? [existingSavedSearch.employmentType]
                : [];

    const nextWorkplaceTypes =
        workplaceSelectionProvided
            ? getWorkplaceTypes(data)
            : existingSavedSearch.workplaceTypes
                  .length > 0
              ? existingSavedSearch.workplaceTypes
              : existingSavedSearch.workplaceType
                ? [existingSavedSearch.workplaceType]
                : [];

    const nextExperienceLevels =
        experienceSelectionProvided
            ? getExperienceLevels(data)
            : existingSavedSearch.experienceLevels
                  .length > 0
              ? existingSavedSearch.experienceLevels
              : existingSavedSearch.experienceLevel
                ? [existingSavedSearch.experienceLevel]
                : [];

    const nextSalaryMin =
        data.salaryMin !== undefined
            ? data.salaryMin
            : toNullableNumber(
                  existingSavedSearch.salaryMin,
              );
    const nextSalaryMax =
        data.salaryMax !== undefined
            ? data.salaryMax
            : toNullableNumber(
                  existingSavedSearch.salaryMax,
              );
    const nextSalaryPeriod =
        data.salaryPeriod !== undefined
            ? data.salaryPeriod
            : existingSavedSearch.salaryPeriod;

    const salaryFilterWasProvided =
        hasOwnField(data, "salaryMin") ||
        hasOwnField(data, "salaryMax") ||
        hasOwnField(data, "salaryCurrency") ||
        hasOwnField(data, "salaryPeriod");

    // Legacy saved searches may contain salary values
    // without a period. Renaming them remains safe;
    // changing their salary filter requires a period.
    if (salaryFilterWasProvided) {
        validateSalaryFilter({
            salaryMin: nextSalaryMin,
            salaryMax: nextSalaryMax,
            salaryPeriod: nextSalaryPeriod,
        });
    }

    const requestedCurrency =
        data.salaryCurrency !== undefined
            ? data.salaryCurrency
            : existingSavedSearch.salaryCurrency;

    const nextSalaryCurrency =
        resolveSalaryCurrency({
            salaryMin: nextSalaryMin,
            salaryMax: nextSalaryMax,
            salaryCurrency: requestedCurrency,
        });

    const nextEmailAlertsEnabled =
        data.emailAlertsEnabled ??
        existingSavedSearch.emailAlertsEnabled;

    const requestedAlertFrequency =
        data.alertFrequency !== undefined
            ? data.alertFrequency
            : existingSavedSearch.alertFrequency;

    const nextAlertFrequency = nextEmailAlertsEnabled
        ? requestedAlertFrequency
        : null;

    if (nextEmailAlertsEnabled && !nextAlertFrequency) {
        throw new AppError(
            400,
            "Choose a daily or weekly frequency when enabling job alerts.",
        );
    }

    const alertSettingsChanged =
        data.emailAlertsEnabled !== undefined ||
        data.alertFrequency !== undefined;
    const filterChanged =
        hasSavedSearchFilterChanges(data);

    if (
        nextEmailAlertsEnabled &&
        (alertSettingsChanged || filterChanged)
    ) {
        await ensureUserCanReceiveSavedSearchAlerts(userId);
    }

    const shouldResetAlertAnchor =
        nextEmailAlertsEnabled &&
        (!existingSavedSearch.emailAlertsEnabled ||
            nextAlertFrequency !==
                existingSavedSearch.alertFrequency ||
            filterChanged);

    const nextLastAlertSentAt = nextEmailAlertsEnabled
        ? shouldResetAlertAnchor ||
          !existingSavedSearch.lastAlertSentAt
            ? new Date()
            : existingSavedSearch.lastAlertSentAt
        : existingSavedSearch.lastAlertSentAt;

    const rawSavedSearch =
        await prisma.savedSearch.update({
            where: {
                id: existingSavedSearch.id,
            },
            data: {
                name: nextName,
                keyword:
                    data.keyword !== undefined
                        ? data.keyword
                        : existingSavedSearch.keyword,
                location:
                    data.location !== undefined
                        ? data.location
                        : existingSavedSearch.location,

                ...(categorySelection && {
                    categoryId:
                        categorySelection.categoryId,
                    categorySlugs:
                        categorySelection.categorySlugs,
                }),

                employmentType:
                    getSingleValueOrNull(
                        nextEmploymentTypes,
                    ),
                employmentTypes:
                    nextEmploymentTypes,

                workplaceType:
                    getSingleValueOrNull(
                        nextWorkplaceTypes,
                    ),
                workplaceTypes:
                    nextWorkplaceTypes,

                experienceLevel:
                    getSingleValueOrNull(
                        nextExperienceLevels,
                    ),
                experienceLevels:
                    nextExperienceLevels,

                salaryMin: nextSalaryMin,
                salaryMax: nextSalaryMax,
                salaryCurrency:
                    nextSalaryCurrency,
                salaryPeriod:
                    nextSalaryMin !== null ||
                    nextSalaryMax !== null
                        ? nextSalaryPeriod
                        : null,
                publishedWithinDays:
                    data.publishedWithinDays !==
                    undefined
                        ? data.publishedWithinDays
                        : existingSavedSearch.publishedWithinDays,

                emailAlertsEnabled:
                    nextEmailAlertsEnabled,
                alertFrequency:
                    nextAlertFrequency,
                lastAlertSentAt:
                    nextLastAlertSentAt,
            },
            select: savedSearchSelect,
        });

    return hydrateSavedSearch(rawSavedSearch);
}

export async function deleteUserSavedSearch({
    userId,
    savedSearchId,
}: DeleteUserSavedSearchInput) {
    const savedSearch =
        await findOwnedSavedSearch(
            userId,
            savedSearchId,
        );

    await prisma.savedSearch.update({
        where: {
            id: savedSearch.id,
        },
        data: {
            deletedAt: new Date(),
            emailAlertsEnabled: false,
            alertFrequency: null,
        },
    });

    return {
        id: savedSearch.id,
    };
}
