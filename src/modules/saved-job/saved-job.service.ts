import {
    JobStatus,
    Prisma,
} from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import type { SavedJobsQueryInput } from "./saved-job.validation.js";

type SavedJobIdentifier = {
    userId: string;
    jobId: string;
};

const savedJobSelect = {
    createdAt: true,

    job: {
        select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            deletedAt: true,
            adminHiddenAt: true,

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
                    deletedAt: true,
                    suspendedAt: true,
                },
            },

            category: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    isActive: true,
                },
            },
        },
    },
} satisfies Prisma.SavedJobSelect;

type SelectedSavedJob = Prisma.SavedJobGetPayload<{
    select: typeof savedJobSelect;
}>;

function isJobAvailable(savedJob: SelectedSavedJob): boolean {
    const now = new Date();

    return (
        savedJob.job.status === JobStatus.PUBLISHED &&
        savedJob.job.deletedAt === null &&
        savedJob.job.adminHiddenAt === null &&
        savedJob.job.company.deletedAt === null &&
        savedJob.job.company.suspendedAt === null &&
        savedJob.job.category.isActive &&
        (savedJob.job.expiresAt === null ||
            savedJob.job.expiresAt > now)
    );
}

function formatSavedJob(savedJob: SelectedSavedJob) {
    const {
        deletedAt: _jobDeletedAt,
        adminHiddenAt: _adminHiddenAt,
        company,
        ...job
    } = savedJob.job;

    const {
        deletedAt: _companyDeletedAt,
        suspendedAt: _companySuspendedAt,
        ...publicCompany
    } = company;

    return {
        savedAt: savedJob.createdAt,

        job: {
            ...job,
            company: publicCompany,
            isAvailable: isJobAvailable(savedJob),
        },
    };
}

function isUniqueConstraintError(error: unknown): boolean {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
    );
}

export async function listUserSavedJobs({
    userId,
    page,
    limit,
}: SavedJobsQueryInput & {
    userId: string;
}) {
    const skip = (page - 1) * limit;

    const where: Prisma.SavedJobWhereInput = {
        userId,
    };

    const [savedJobs, totalItems] = await Promise.all([
        prisma.savedJob.findMany({
            where,
            select: savedJobSelect,

            orderBy: {
                createdAt: "desc",
            },

            skip,
            take: limit,
        }),

        prisma.savedJob.count({
            where,
        }),
    ]);

    const totalPages = Math.max(
        1,
        Math.ceil(totalItems / limit),
    );

    return {
        savedJobs: savedJobs.map(formatSavedJob),

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

export async function getUserSavedJobStatus({
    userId,
    jobId,
}: SavedJobIdentifier) {
    const savedJob = await prisma.savedJob.findUnique({
        where: {
            userId_jobId: {
                userId,
                jobId,
            },
        },

        select: {
            createdAt: true,
        },
    });

    return {
        isSaved: savedJob !== null,
        savedAt: savedJob?.createdAt ?? null,
    };
}

export async function saveJobForUser({
    userId,
    jobId,
}: SavedJobIdentifier) {
    const now = new Date();

    const job = await prisma.job.findUnique({
        where: {
            id: jobId,
        },

        select: {
            id: true,
            status: true,
            deletedAt: true,
            adminHiddenAt: true,
            expiresAt: true,

            company: {
                select: {
                    deletedAt: true,
                    suspendedAt: true,
                },
            },
            category: {
                select: {
                    isActive: true,
                },
            },
        },
    });

    if (
        !job ||
        job.deletedAt !== null ||
        job.adminHiddenAt !== null ||
        job.company.deletedAt !== null ||
        job.company.suspendedAt !== null ||
        !job.category.isActive
    ) {
        throw new AppError(404, "Job not found.");
    }

    if (job.status !== JobStatus.PUBLISHED) {
        throw new AppError(
            409,
            "Only published jobs can be saved.",
        );
    }

    if (job.expiresAt && job.expiresAt <= now) {
        throw new AppError(
            409,
            "This job has expired and can no longer be saved.",
        );
    }

    const existingSavedJob =
        await prisma.savedJob.findUnique({
            where: {
                userId_jobId: {
                    userId,
                    jobId,
                },
            },

            select: {
                createdAt: true,
            },
        });

    if (existingSavedJob) {
        throw new AppError(
            409,
            "This job is already in your saved jobs.",
        );
    }

    try {
        const savedJob = await prisma.savedJob.create({
            data: {
                userId,
                jobId,
            },

            select: savedJobSelect,
        });

        return formatSavedJob(savedJob);
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            throw new AppError(
                409,
                "This job is already in your saved jobs.",
            );
        }

        throw error;
    }
}

export async function removeSavedJobForUser({
    userId,
    jobId,
}: SavedJobIdentifier) {
    const savedJob = await prisma.savedJob.findUnique({
        where: {
            userId_jobId: {
                userId,
                jobId,
            },
        },

        select: {
            userId: true,
            jobId: true,
        },
    });

    if (!savedJob) {
        throw new AppError(
            404,
            "This job is not in your saved jobs.",
        );
    }

    await prisma.savedJob.delete({
        where: {
            userId_jobId: {
                userId,
                jobId,
            },
        },
    });

    return {
        jobId,
    };
}
