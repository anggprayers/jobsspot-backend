import {
    ApplicationStatus,
    JobStatus,
    Prisma,
} from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import { createResumeDownloadUrl } from "../resume/resume-storage.service.js";

import type {
    CreateJobApplicationInput,
    JobSeekerApplicationsQueryInput,
} from "./job-seeker-application.validation.js";

type CreateUserApplicationParameters = {
    applicantId: string;
    data: CreateJobApplicationInput;
};

type GetUserApplicationParameters = {
    applicantId: string;
    applicationId: string;
};

type GetUserApplicationForJobParameters = {
    applicantId: string;
    jobId: string;
};

const applicationSelect = {
    id: true,
    coverLetter: true,
    status: true,
    appliedAt: true,
    reviewedAt: true,
    withdrawnAt: true,
    createdAt: true,
    updatedAt: true,

    job: {
        select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            employmentType: true,
            workplaceType: true,
            experienceLevel: true,
            location: true,
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
    },

    resume: {
        select: {
            id: true,
            name: true,
            mimeType: true,
            fileSize: true,
            isDefault: true,
        },
    },
} satisfies Prisma.ApplicationSelect;

function getStatusCount(
    statusCounts: {
        status: ApplicationStatus;
        _count: {
            _all: number;
        };
    }[],
    status: ApplicationStatus,
): number {
    return (
        statusCounts.find((item) => item.status === status)?._count
            ._all ?? 0
    );
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
    );
}

export async function createUserApplication({
    applicantId,
    data,
}: CreateUserApplicationParameters) {
    const now = new Date();

    const job = await prisma.job.findUnique({
        where: {
            id: data.jobId,
        },

        select: {
            id: true,
            status: true,
            applicationDeadline: true,
            expiresAt: true,
            deletedAt: true,

            company: {
                select: {
                    deletedAt: true,
                    suspendedAt: true,
                },
            },
        },
    });

    if (
        !job ||
        job.deletedAt !== null ||
        job.company.deletedAt !== null ||
        job.company.suspendedAt !== null
    ) {
        throw new AppError(404, "Job not found.");
    }

    if (job.status !== JobStatus.PUBLISHED) {
        throw new AppError(
            409,
            "This job is not currently accepting applications.",
        );
    }

    if (
        job.applicationDeadline &&
        job.applicationDeadline < now
    ) {
        throw new AppError(
            409,
            "The application deadline for this job has passed.",
        );
    }

    if (job.expiresAt && job.expiresAt <= now) {
        throw new AppError(
            409,
            "This job posting has expired and is no longer accepting applications.",
        );
    }

    const resume = await prisma.resume.findFirst({
        where: {
            id: data.resumeId,
            userId: applicantId,
            deletedAt: null,
        },

        select: {
            id: true,
        },
    });

    if (!resume) {
        throw new AppError(
            404,
            "The selected resume was not found in your account.",
        );
    }

    const existingApplication =
        await prisma.application.findUnique({
            where: {
                jobId_applicantId: {
                    jobId: data.jobId,
                    applicantId,
                },
            },

            select: {
                id: true,
                status: true,
            },
        });

    if (existingApplication) {
        throw new AppError(
            409,
            "You have already applied for this job.",
        );
    }

    try {
        return await prisma.application.create({
            data: {
                jobId: data.jobId,
                applicantId,
                resumeId: resume.id,
                coverLetter: data.coverLetter ?? null,
            },

            select: applicationSelect,
        });
    } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
            throw new AppError(
                409,
                "You have already applied for this job.",
            );
        }

        throw error;
    }
}

export async function getUserApplications({
    applicantId,
    status,
    page,
    limit,
}: JobSeekerApplicationsQueryInput & {
    applicantId: string;
}) {
    const where: Prisma.ApplicationWhereInput = {
        applicantId,

        ...(status && {
            status,
        }),
    };

    const skip = (page - 1) * limit;

    const [applications, totalItems, statusCounts] =
        await Promise.all([
            prisma.application.findMany({
                where,
                select: applicationSelect,

                orderBy: [
                    {
                        appliedAt: "desc",
                    },
                    {
                        createdAt: "desc",
                    },
                ],

                skip,
                take: limit,
            }),

            prisma.application.count({
                where,
            }),

            prisma.application.groupBy({
                by: ["status"],

                where: {
                    applicantId,
                },

                _count: {
                    _all: true,
                },
            }),
        ]);

    const totalPages = Math.max(
        1,
        Math.ceil(totalItems / limit),
    );

    return {
        applications,

        summary: {
            totalApplications: statusCounts.reduce(
                (total, item) => total + item._count._all,
                0,
            ),

            submitted: getStatusCount(
                statusCounts,
                ApplicationStatus.SUBMITTED,
            ),

            underReview: getStatusCount(
                statusCounts,
                ApplicationStatus.UNDER_REVIEW,
            ),

            shortlisted: getStatusCount(
                statusCounts,
                ApplicationStatus.SHORTLISTED,
            ),

            interviews: getStatusCount(
                statusCounts,
                ApplicationStatus.INTERVIEW,
            ),

            offered: getStatusCount(
                statusCounts,
                ApplicationStatus.OFFERED,
            ),

            hired: getStatusCount(
                statusCounts,
                ApplicationStatus.HIRED,
            ),

            rejected: getStatusCount(
                statusCounts,
                ApplicationStatus.REJECTED,
            ),

            withdrawn: getStatusCount(
                statusCounts,
                ApplicationStatus.WITHDRAWN,
            ),
        },

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

export async function getUserApplicationById({
    applicantId,
    applicationId,
}: GetUserApplicationParameters) {
    const application = await prisma.application.findFirst({
        where: {
            id: applicationId,
            applicantId,
        },

        select: applicationSelect,
    });

    if (!application) {
        throw new AppError(404, "Application not found.");
    }

    return application;
}

export async function getUserApplicationForJob({
    applicantId,
    jobId,
}: GetUserApplicationForJobParameters) {
    return prisma.application.findUnique({
        where: {
            jobId_applicantId: {
                jobId,
                applicantId,
            },
        },

        select: applicationSelect,
    });
}

export async function getUserApplicationResumeDownload({
    applicantId,
    applicationId,
}: GetUserApplicationParameters) {
    const application = await prisma.application.findFirst({
        where: {
            id: applicationId,
            applicantId,
        },

        select: {
            id: true,

            resume: {
                select: {
                    id: true,
                    name: true,
                    mimeType: true,
                    fileKey: true,
                },
            },
        },
    });

    if (!application) {
        throw new AppError(404, "Application not found.");
    }

    if (!application.resume) {
        throw new AppError(
            404,
            "The resume submitted with this application is no longer available.",
        );
    }

    const downloadUrl = await createResumeDownloadUrl({
        fileKey: application.resume.fileKey,
    });

    return {
        resume: {
            id: application.resume.id,
            name: application.resume.name,
            mimeType: application.resume.mimeType,
        },
        downloadUrl,
        expiresInSeconds: 5 * 60,
    };
}

export async function withdrawUserApplication({
    applicantId,
    applicationId,
}: GetUserApplicationParameters) {
    const application = await prisma.application.findFirst({
        where: {
            id: applicationId,
            applicantId,
        },

        select: {
            id: true,
            status: true,
        },
    });

    if (!application) {
        throw new AppError(404, "Application not found.");
    }

    if (application.status === ApplicationStatus.WITHDRAWN) {
        throw new AppError(
            409,
            "This application has already been withdrawn.",
        );
    }

    if (
        application.status === ApplicationStatus.HIRED ||
        application.status === ApplicationStatus.REJECTED
    ) {
        throw new AppError(
            409,
            "This application can no longer be withdrawn.",
        );
    }

    return prisma.application.update({
        where: {
            id: application.id,
        },

        data: {
            status: ApplicationStatus.WITHDRAWN,
            withdrawnAt: new Date(),
        },

        select: applicationSelect,
    });
}
