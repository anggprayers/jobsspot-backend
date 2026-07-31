import { JobStatus } from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

function getAvailableJobConditions() {
    const now = new Date();

    return {
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
    };
}

export async function getPublicJobCategories() {
    const categories = await prisma.jobCategory.findMany({
        orderBy: {
            name: "asc",
        },

        select: {
            id: true,
            name: true,
            slug: true,

            _count: {
                select: {
                    jobs: {
                        where: getAvailableJobConditions(),
                    },
                },
            },
        },
    });

    return categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        jobCount: category._count.jobs,
    }));
}

export async function getPublicJobCategoryBySlug(slug: string) {
    const category = await prisma.jobCategory.findUnique({
        where: {
            slug,
        },

        select: {
            id: true,
            name: true,
            slug: true,

            _count: {
                select: {
                    jobs: {
                        where: getAvailableJobConditions(),
                    },
                },
            },
        },
    });

    if (!category) {
        throw new AppError(404, "Job category not found.");
    }

    return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        jobCount: category._count.jobs,
    };
}
