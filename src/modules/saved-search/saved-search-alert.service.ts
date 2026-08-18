import {
    JobStatus,
    Prisma,
    SavedSearchAlertFrequency,
} from "../../generated/prisma/client.js";

import { prisma } from "../../lib/prisma.js";
import { emailConfig } from "../email/email.config.js";
import { sendTransactionalEmail } from "../email/email.service.js";
import { createSavedSearchAlertEmailTemplate } from "../email/templates/saved-search-alert.template.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const PROCESS_BATCH_SIZE = 50;
const MAX_JOBS_PER_EMAIL = 20;

const alertSavedSearchSelect = {
    id: true,
    name: true,
    keyword: true,
    location: true,
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
    category: {
        select: {
            slug: true,
        },
    },
    user: {
        select: {
            id: true,
            email: true,
            firstName: true,
        },
    },
} satisfies Prisma.SavedSearchSelect;

type AlertSavedSearch = Prisma.SavedSearchGetPayload<{
    select: typeof alertSavedSearchSelect;
}>;

function getPublishedAfterDate(now: Date, days: number): Date {
    return new Date(now.getTime() - days * DAY_MS);
}

function toNumber(value: Prisma.Decimal | null): number | null {
    return value === null ? null : Number(value);
}

function getCategorySlugs(savedSearch: AlertSavedSearch): string[] {
    if (savedSearch.categorySlugs.length > 0) {
        return savedSearch.categorySlugs;
    }

    return savedSearch.category ? [savedSearch.category.slug] : [];
}

function getEmploymentTypes(savedSearch: AlertSavedSearch) {
    return savedSearch.employmentTypes.length > 0
        ? savedSearch.employmentTypes
        : savedSearch.employmentType
          ? [savedSearch.employmentType]
          : [];
}

function getWorkplaceTypes(savedSearch: AlertSavedSearch) {
    return savedSearch.workplaceTypes.length > 0
        ? savedSearch.workplaceTypes
        : savedSearch.workplaceType
          ? [savedSearch.workplaceType]
          : [];
}

function getExperienceLevels(savedSearch: AlertSavedSearch) {
    return savedSearch.experienceLevels.length > 0
        ? savedSearch.experienceLevels
        : savedSearch.experienceLevel
          ? [savedSearch.experienceLevel]
          : [];
}

function buildJobWhere(
    savedSearch: AlertSavedSearch,
    since: Date,
    now: Date,
): Prisma.JobWhereInput {
    const conditions: Prisma.JobWhereInput[] = [
        {
            status: JobStatus.PUBLISHED,
            deletedAt: null,
            adminHiddenAt: null,
            publishedAt: {
                gt: since,
                lte: now,
            },
        },
        {
            company: {
                deletedAt: null,
                suspendedAt: null,
            },
        },
        {
            category: {
                isActive: true,
            },
        },
        {
            OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } },
            ],
        },
    ];

    if (savedSearch.keyword) {
        conditions.push({
            OR: [
                {
                    title: {
                        contains: savedSearch.keyword,
                        mode: "insensitive",
                    },
                },
                {
                    description: {
                        contains: savedSearch.keyword,
                        mode: "insensitive",
                    },
                },
                {
                    company: {
                        name: {
                            contains: savedSearch.keyword,
                            mode: "insensitive",
                        },
                    },
                },
            ],
        });
    }

    const categorySlugs = getCategorySlugs(savedSearch);
    if (categorySlugs.length > 0) {
        conditions.push({
            category: {
                slug: { in: categorySlugs },
            },
        });
    }

    const employmentTypes = getEmploymentTypes(savedSearch);
    if (employmentTypes.length > 0) {
        conditions.push({
            employmentType: { in: employmentTypes },
        });
    }

    const workplaceTypes = getWorkplaceTypes(savedSearch);
    if (workplaceTypes.length > 0) {
        conditions.push({
            workplaceType: { in: workplaceTypes },
        });
    }

    const experienceLevels = getExperienceLevels(savedSearch);
    if (experienceLevels.length > 0) {
        conditions.push({
            experienceLevel: { in: experienceLevels },
        });
    }

    if (savedSearch.location) {
        conditions.push({
            OR: [
                {
                    location: {
                        contains: savedSearch.location,
                        mode: "insensitive",
                    },
                },
                {
                    city: {
                        contains: savedSearch.location,
                        mode: "insensitive",
                    },
                },
                {
                    stateRegion: {
                        contains: savedSearch.location,
                        mode: "insensitive",
                    },
                },
                {
                    countryCode: {
                        contains: savedSearch.location,
                        mode: "insensitive",
                    },
                },
            ],
        });
    }

    if (savedSearch.salaryPeriod) {
        conditions.push({ salaryPeriod: savedSearch.salaryPeriod });
    }

    if (savedSearch.salaryCurrency) {
        conditions.push({
            salaryCurrency: {
                equals: savedSearch.salaryCurrency,
                mode: "insensitive",
            },
        });
    }

    const salaryMin = toNumber(savedSearch.salaryMin);
    const salaryMax = toNumber(savedSearch.salaryMax);

    if (salaryMin !== null) {
        conditions.push({
            OR: [
                { salaryMax: { gte: salaryMin } },
                {
                    AND: [
                        { salaryMax: null },
                        { salaryMin: { gte: salaryMin } },
                    ],
                },
            ],
        });
    }

    if (salaryMax !== null) {
        conditions.push({
            OR: [
                { salaryMin: { lte: salaryMax } },
                {
                    AND: [
                        { salaryMin: null },
                        { salaryMax: { lte: salaryMax } },
                    ],
                },
            ],
        });
    }

    if (savedSearch.publishedWithinDays) {
        conditions.push({
            publishedAt: {
                gte: getPublishedAfterDate(
                    now,
                    savedSearch.publishedWithinDays,
                ),
            },
        });
    }

    return { AND: conditions };
}

function buildSavedSearchPath(savedSearch: AlertSavedSearch): string {
    const params = new URLSearchParams();
    const categories = getCategorySlugs(savedSearch);
    const employmentTypes = getEmploymentTypes(savedSearch);
    const workplaceTypes = getWorkplaceTypes(savedSearch);
    const experienceLevels = getExperienceLevels(savedSearch);

    if (savedSearch.keyword) params.set("search", savedSearch.keyword);
    if (savedSearch.location) params.set("location", savedSearch.location);
    if (categories.length > 0) params.set("category", categories.join(","));
    if (employmentTypes.length > 0) {
        params.set("employmentType", employmentTypes.join(","));
    }
    if (workplaceTypes.length > 0) {
        params.set("workplaceType", workplaceTypes.join(","));
    }
    if (experienceLevels.length > 0) {
        params.set("experienceLevel", experienceLevels.join(","));
    }
    if (savedSearch.salaryPeriod) {
        params.set("salaryPeriod", savedSearch.salaryPeriod);
    }
    if (savedSearch.salaryCurrency) {
        params.set("salaryCurrency", savedSearch.salaryCurrency);
    }
    if (savedSearch.salaryMin !== null) {
        params.set("salaryMin", String(savedSearch.salaryMin));
    }
    if (savedSearch.salaryMax !== null) {
        params.set("salaryMax", String(savedSearch.salaryMax));
    }
    if (savedSearch.publishedWithinDays) {
        params.set(
            "publishedWithinDays",
            String(savedSearch.publishedWithinDays),
        );
    }

    params.set("page", "1");
    return `/jobs?${params.toString()}`;
}

function absoluteUrl(path: string): string {
    return `${emailConfig.frontendUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function processDueSavedSearchAlerts(now = new Date()) {
    const dailyCutoff = new Date(now.getTime() - DAY_MS);
    const weeklyCutoff = new Date(now.getTime() - 7 * DAY_MS);

    const savedSearches = await prisma.savedSearch.findMany({
        where: {
            deletedAt: null,
            emailAlertsEnabled: true,
            alertFrequency: { not: null },
            user: {
                deletedAt: null,
                suspendedAt: null,
                isEmailVerified: true,
            },
            OR: [
                {
                    alertFrequency: SavedSearchAlertFrequency.DAILY,
                    OR: [
                        { lastAlertSentAt: null },
                        { lastAlertSentAt: { lte: dailyCutoff } },
                    ],
                },
                {
                    alertFrequency: SavedSearchAlertFrequency.WEEKLY,
                    OR: [
                        { lastAlertSentAt: null },
                        { lastAlertSentAt: { lte: weeklyCutoff } },
                    ],
                },
            ],
        },
        select: alertSavedSearchSelect,
        orderBy: [
            { lastAlertSentAt: { sort: "asc", nulls: "first" } },
            { createdAt: "asc" },
        ],
        take: PROCESS_BATCH_SIZE,
    });

    let emailed = 0;
    let noMatches = 0;
    let failed = 0;
    let matchingJobs = 0;

    for (const savedSearch of savedSearches) {
        if (!savedSearch.alertFrequency) {
            continue;
        }

        const since = savedSearch.lastAlertSentAt ?? savedSearch.createdAt;
        const where = buildJobWhere(savedSearch, since, now);

        try {
            const totalMatches = await prisma.job.count({ where });

            if (totalMatches === 0) {
                await prisma.savedSearch.update({
                    where: { id: savedSearch.id },
                    data: { lastAlertSentAt: now },
                });
                noMatches += 1;
                continue;
            }

            const jobs = await prisma.job.findMany({
                where,
                orderBy: { publishedAt: "desc" },
                take: MAX_JOBS_PER_EMAIL,
                select: {
                    title: true,
                    slug: true,
                    employmentType: true,
                    workplaceType: true,
                    location: true,
                    city: true,
                    stateRegion: true,
                    countryCode: true,
                    salaryMin: true,
                    salaryMax: true,
                    salaryCurrency: true,
                    salaryPeriod: true,
                    company: {
                        select: { name: true },
                    },
                },
            });

            const searchUrl = absoluteUrl(buildSavedSearchPath(savedSearch));
            const manageAlertsUrl = absoluteUrl("/account/saved-searches");
            const email = createSavedSearchAlertEmailTemplate({
                recipientName: savedSearch.user.firstName,
                savedSearchName: savedSearch.name,
                frequency: savedSearch.alertFrequency,
                totalMatches,
                jobs: jobs.map((job) => ({
                    title: job.title,
                    companyName: job.company.name,
                    location:
                        job.location ??
                        ([job.city, job.stateRegion, job.countryCode]
                            .filter(Boolean)
                            .join(", ") || null),
                    employmentType: job.employmentType,
                    workplaceType: job.workplaceType,
                    salaryMin: toNumber(job.salaryMin),
                    salaryMax: toNumber(job.salaryMax),
                    salaryCurrency: job.salaryCurrency,
                    salaryPeriod: job.salaryPeriod,
                    url: absoluteUrl(`/jobs/${encodeURIComponent(job.slug)}`),
                })),
                searchUrl,
                manageAlertsUrl,
            });

            await sendTransactionalEmail({
                to: savedSearch.user.email,
                subject: email.subject,
                html: email.html,
                text: email.text,
                idempotencyKey: `saved-search-alert:${savedSearch.id}:${since.toISOString()}`,
            });

            await prisma.savedSearch.update({
                where: { id: savedSearch.id },
                data: { lastAlertSentAt: now },
            });

            emailed += 1;
            matchingJobs += totalMatches;
        } catch (error) {
            failed += 1;
            console.error("Saved search alert delivery failed.", {
                savedSearchId: savedSearch.id,
                userId: savedSearch.user.id,
                frequency: savedSearch.alertFrequency,
                error,
            });
        }
    }

    return {
        searchesScanned: savedSearches.length,
        emailed,
        noMatches,
        failed,
        matchingJobs,
        batchSize: PROCESS_BATCH_SIZE,
        maxJobsPerEmail: MAX_JOBS_PER_EMAIL,
        processedAt: now,
    };
}
