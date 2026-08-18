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

import {
    createCoverLetterDownloadUrl,
    createCoverLetterFileKey,
    deleteCoverLetterObject,
    uploadCoverLetterObject,
    validateCoverLetterFile,
} from "./application-cover-letter-storage.service.js";

import type {
    CreateJobApplicationInput,
    JobSeekerApplicationsQueryInput,
} from "./job-seeker-application.validation.js";

type CreateUserApplicationParameters = {
    applicantId: string;
    data: CreateJobApplicationInput;
    coverLetterFile?: Express.Multer.File;
};

type GetUserApplicationParameters = {
    applicantId: string;
    applicationId: string;
};

type GetUserApplicationForJobParameters = {
    applicantId: string;
    jobId: string;
};

const REAPPLY_COOLDOWN_DAYS = 90;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const APPLICATION_SUBMISSION_LOCK_NAMESPACE = 918273645;

const ACTIVE_APPLICATION_STATUSES = new Set<ApplicationStatus>([
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFERED,
    ApplicationStatus.HIRED,
]);

function getReapplyEligibleAt(application: {
    status: ApplicationStatus;
    withdrawnAt: Date | null;
    updatedAt: Date;
}): Date | null {
    if (application.status !== ApplicationStatus.REJECTED && application.status !== ApplicationStatus.WITHDRAWN) {
        return null;
    }

    const terminalAt = application.status === ApplicationStatus.WITHDRAWN
        ? (application.withdrawnAt ?? application.updatedAt)
        : application.updatedAt;

    return new Date(terminalAt.getTime() + REAPPLY_COOLDOWN_DAYS * MILLISECONDS_PER_DAY);
}

function assertCanReapply(application: {
    status: ApplicationStatus;
    withdrawnAt: Date | null;
    updatedAt: Date;
} | null, now: Date): void {
    if (!application) {
        return;
    }

    if (ACTIVE_APPLICATION_STATUSES.has(application.status)) {
        throw new AppError(409, "You already have an active application for this job.", {
            details: {
                code: "APPLICATION_ALREADY_ACTIVE",
                applicationStatus: application.status,
            },
        });
    }

    const nextEligibleAt = getReapplyEligibleAt(application);

    if (nextEligibleAt && now < nextEligibleAt) {
        throw new AppError(409, `You can apply for this job again after ${nextEligibleAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}.`, {
            details: {
                code: "APPLICATION_REAPPLY_COOLDOWN",
                cooldownDays: REAPPLY_COOLDOWN_DAYS,
                nextEligibleAt: nextEligibleAt.toISOString(),
                previousStatus: application.status,
            },
        });
    }
}

const applicationSelect = {
    id: true,
    coverLetter: true,
    coverLetterFileName: true,
    coverLetterFileMimeType: true,
    coverLetterFileSize: true,
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

export async function createUserApplication({
    applicantId,
    data,
    coverLetterFile,
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
                adminHiddenAt: true,

                company: {
                    select: {
                        id: true,
                        name: true,
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
        job.adminHiddenAt !== null ||
        job.company.deletedAt !== null ||
        job.company.suspendedAt !== null ||
        !job.category.isActive
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

    if (coverLetterFile && data.coverLetter) {
        throw new AppError(400, "Choose either a written cover letter or an uploaded cover letter file, not both.");
    }

    const applicantName =
        `${applicant.firstName} ${applicant.lastName}`.trim();

    let uploadedCoverLetterKey: string | null = null;
    let coverLetterFileMimeType: string | null = null;

    if (coverLetterFile) {
        coverLetterFileMimeType = validateCoverLetterFile(coverLetterFile);
        uploadedCoverLetterKey = createCoverLetterFileKey({
            userId: applicantId,
            originalName: coverLetterFile.originalname,
        });

        await uploadCoverLetterObject({
            fileKey: uploadedCoverLetterKey,
            fileBuffer: coverLetterFile.buffer,
            mimeType: coverLetterFileMimeType,
        });
    }

    try {
        const application = await prisma.$transaction(async (transaction) => {
            await transaction.$queryRaw<Array<{ lockResult: string }>>`
                SELECT pg_advisory_xact_lock(
                    ${APPLICATION_SUBMISSION_LOCK_NAMESPACE},
                    hashtext(${`${data.jobId}:${applicantId}`}::text)
                )::text AS "lockResult"
            `;

            const latestApplication = await transaction.application.findFirst({
                where: {
                    jobId: data.jobId,
                    applicantId,
                },
                select: {
                    status: true,
                    withdrawnAt: true,
                    updatedAt: true,
                },
                orderBy: [
                    { appliedAt: "desc" },
                    { createdAt: "desc" },
                ],
            });

            assertCanReapply(latestApplication, now);

            return transaction.application.create({
                data: {
                    jobId: data.jobId,
                    applicantId,
                    resumeId: resume.id,
                    coverLetter: data.coverLetter ?? null,
                    coverLetterFileKey: uploadedCoverLetterKey,
                    coverLetterFileName: coverLetterFile?.originalname ?? null,
                    coverLetterFileMimeType,
                    coverLetterFileSize: coverLetterFile?.size ?? null,
                },
                select: applicationSelect,
            });
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
        if (uploadedCoverLetterKey) {
            await deleteCoverLetterObject(uploadedCoverLetterKey);
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
    const application = await prisma.application.findFirst({
        where: {
            jobId,
            applicantId,
        },
        select: applicationSelect,
        orderBy: [
            { appliedAt: "desc" },
            { createdAt: "desc" },
        ],
    });

    const now = new Date();
    const nextEligibleAt = application
        ? getReapplyEligibleAt(application)
        : null;
    const hasActiveApplication = application
        ? ACTIVE_APPLICATION_STATUSES.has(application.status)
        : false;
    const canApply =
        !application ||
        (!hasActiveApplication &&
            (!nextEligibleAt || now >= nextEligibleAt));

    return {
        application,
        reapplication: {
            canApply,
            cooldownDays: REAPPLY_COOLDOWN_DAYS,
            nextEligibleAt: nextEligibleAt?.toISOString() ?? null,
            previousStatus: application?.status ?? null,
        },
    };
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

export async function getUserApplicationCoverLetterDownload({
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
            coverLetterFileKey: true,
            coverLetterFileName: true,
            coverLetterFileMimeType: true,
            coverLetterFileSize: true,
        },
    });

    if (!application) {
        throw new AppError(404, "Application not found.");
    }

    if (
        !application.coverLetterFileKey ||
        !application.coverLetterFileName ||
        !application.coverLetterFileMimeType ||
        application.coverLetterFileSize === null
    ) {
        throw new AppError(404, "No cover letter file is attached to this application.");
    }

    const downloadUrl = await createCoverLetterDownloadUrl({
        fileKey: application.coverLetterFileKey,
    });

    return {
        coverLetterFile: {
            name: application.coverLetterFileName,
            mimeType: application.coverLetterFileMimeType,
            fileSize: application.coverLetterFileSize,
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
