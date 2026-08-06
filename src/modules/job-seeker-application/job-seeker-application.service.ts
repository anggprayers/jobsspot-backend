import {
    ApplicationStatus,
    JobStatus,
    Prisma,
} from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import {
    createApplicationSubmittedNotifications,
    createApplicationWithdrawnNotifications,
} from "../notification/application-notification.service.js";
import { runNotificationTaskSafely } from "../notification/notification.service.js";
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
    firstViewedAt: true,
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

    const [job, applicant] = await Promise.all([
        prisma.job.findUnique({
            where: {
                id: data.jobId,
            },

            select: {
                id: true,
                title: true,
                status: true,
                applicationDeadline: true,
                expiresAt: true,
                deletedAt: true,

                company: {
                    select: {
                        id: true,
                        name: true,
                        deletedAt: true,
                        suspendedAt: true,
                    },
                },
            },
        }),

        prisma.user.findFirst({
            where: {
                id: applicantId,
                deletedAt: null,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
            },
        }),
    ]);

    if (
        !job ||
        job.deletedAt !== null ||
        job.company.deletedAt !== null ||
        job.company.suspendedAt !== null
    ) {
        throw new AppError(404, "Job not found.");
    }

    if (!applicant) {
        throw new AppError(404, "Applicant account not found.");
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

    const applicantName =
        `${applicant.firstName} ${applicant.lastName}`.trim();

    try {
        const application = await prisma.application.create({
            data: {
                jobId: data.jobId,
                applicantId,
                resumeId: resume.id,
                coverLetter: data.coverLetter ?? null,
            },

            select: applicationSelect,
        });

        await runNotificationTaskSafely(
            `application submitted (${application.id})`,
            () =>
                createApplicationSubmittedNotifications({
                    client: prisma,
                    applicationId: application.id,
                    applicantId,
                    applicantName,
                    jobId: job.id,
                    jobTitle: job.title,
                    companyId: job.company.id,
                    companyName: job.company.name,
                }),
        );

        return application;

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

            applicant: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                },
            },

            job: {
                select: {
                    id: true,
                    title: true,

                    company: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
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

    const applicantName =
        `${application.applicant.firstName} ${application.applicant.lastName}`.trim();

    const updatedApplication = await prisma.application.update({
        where: {
            id: application.id,
        },

        data: {
            status: ApplicationStatus.WITHDRAWN,
            withdrawnAt: new Date(),
        },

        select: applicationSelect,
    });

    await runNotificationTaskSafely(
        `application withdrawn (${application.id})`,
        () =>
            createApplicationWithdrawnNotifications({
                client: prisma,
                applicationId: application.id,
                applicantId: application.applicant.id,
                applicantName,
                jobId: application.job.id,
                jobTitle: application.job.title,
                companyId: application.job.company.id,
                companyName: application.job.company.name,
            }),
    );

    return updatedApplication;
}
