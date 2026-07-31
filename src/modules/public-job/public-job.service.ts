import { JobStatus, Prisma } from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import type { GetPublicJobsQuery } from "./public-job.validation.js";

export async function getPublicJobs(query: GetPublicJobsQuery) {
    const { page, limit, search, category, employmentType, workplaceType, experienceLevel, location, sort } = query;

    const skip = (page - 1) * limit;
    const now = new Date();

    const conditions: Prisma.JobWhereInput[] = [
        {
            status: JobStatus.PUBLISHED,
            deletedAt: null,
        },

        {
            company: {
                deletedAt: null,
            },
        },

        {
            OR: [
                {
                    expiresAt: null,
                },
                {
                    expiresAt: {
                        gt: now,
                    },
                },
            ],
        },
    ];

    if (search) {
        conditions.push({
            OR: [
                {
                    title: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    description: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    company: {
                        name: {
                            contains: search,
                            mode: "insensitive",
                        },
                    },
                },
            ],
        });
    }

    if (category) {
        conditions.push({
            category: {
                slug: category,
            },
        });
    }

    if (employmentType) {
        conditions.push({
            employmentType,
        });
    }

    if (workplaceType) {
        conditions.push({
            workplaceType,
        });
    }

    if (experienceLevel) {
        conditions.push({
            experienceLevel,
        });
    }

    if (location) {
        conditions.push({
            location: {
                contains: location,
                mode: "insensitive",
            },
        });
    }

    const where: Prisma.JobWhereInput = {
        AND: conditions,
    };

    let orderBy: Prisma.JobOrderByWithRelationInput;

    switch (sort) {
        case "oldest":
            orderBy = {
                publishedAt: "asc",
            };
            break;

        case "salary_high":
            orderBy = {
                salaryMax: {
                    sort: "desc",
                    nulls: "last",
                },
            };
            break;

        case "salary_low":
            orderBy = {
                salaryMin: {
                    sort: "asc",
                    nulls: "last",
                },
            };
            break;

        case "newest":
        default:
            orderBy = {
                publishedAt: "desc",
            };
            break;
    }

    const jobs = await prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy,

        select: {
            id: true,
            title: true,
            slug: true,

            employmentType: true,
            workplaceType: true,
            experienceLevel: true,

            location: true,

            salaryMin: true,
            salaryMax: true,
            salaryCurrency: true,
            salaryPeriod: true,

            applicationDeadline: true,
            publishedAt: true,
            expiresAt: true,

            company: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                },
            },

            category: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
        },
    });

    const totalItems = await prisma.job.count({
        where,
    });

    const totalPages = Math.ceil(totalItems / limit);

    return {
        jobs,

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

export async function getPublicJobBySlug(slug: string) {
    const now = new Date();

    const job = await prisma.job.findFirst({
        where: {
            slug,
            status: JobStatus.PUBLISHED,
            deletedAt: null,

            company: {
                deletedAt: null,
            },

            OR: [
                {
                    expiresAt: null,
                },
                {
                    expiresAt: {
                        gt: now,
                    },
                },
            ],
        },

        select: {
            id: true,
            title: true,
            slug: true,

            description: true,
            requirements: true,
            responsibilities: true,

            employmentType: true,
            workplaceType: true,
            experienceLevel: true,

            location: true,

            salaryMin: true,
            salaryMax: true,
            salaryCurrency: true,
            salaryPeriod: true,

            applicationDeadline: true,
            publishedAt: true,
            expiresAt: true,

            company: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                },
            },

            category: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
        },
    });

    if (!job) {
        throw new AppError(404, "Published job not found.");
    }

    return job;
}
