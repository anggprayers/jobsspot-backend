import { ApplicationStatus, Prisma } from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import { AuditAction, AuditEntityType } from "../audit-log/audit-log.constants.js";

import { createCompanyAuditLog } from "../audit-log/audit-log.service.js";

type GetCompanyApplicationsParameters = {
    companyId: string;
    search?: string;
    jobId?: string;
    status?: ApplicationStatus;
    page: number;
    limit: number;
};

type GetCompanyApplicationParameters = {
    companyId: string;
    applicationId: string;
};

type UpdateCompanyApplicationStatusParameters = GetCompanyApplicationParameters & {
    actorUserId: string;

    status:
        | typeof ApplicationStatus.UNDER_REVIEW
        | typeof ApplicationStatus.SHORTLISTED
        | typeof ApplicationStatus.INTERVIEW
        | typeof ApplicationStatus.OFFERED
        | typeof ApplicationStatus.HIRED
        | typeof ApplicationStatus.REJECTED;
};

const applicationListSelect = {
    id: true,
    status: true,
    appliedAt: true,
    reviewedAt: true,
    withdrawnAt: true,
    updatedAt: true,

    applicant: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,

            jobSeekerProfile: {
                select: {
                    headline: true,
                    location: true,
                    yearsOfExperience: true,
                },
            },
        },
    },

    job: {
        select: {
            id: true,
            title: true,
            slug: true,
            status: true,
        },
    },

    resume: {
        select: {
            id: true,
            name: true,
            mimeType: true,
            fileSize: true,
        },
    },
} satisfies Prisma.ApplicationSelect;

export async function getCompanyApplications({
    companyId,
    search,
    jobId,
    status,
    page,
    limit,
}: GetCompanyApplicationsParameters) {
    const normalizedSearch = search?.trim() ?? "";

    const companyApplicationsWhere: Prisma.ApplicationWhereInput = {
        job: {
            companyId,
            deletedAt: null,
        },

        applicant: {
            deletedAt: null,
        },
    };

    const where: Prisma.ApplicationWhereInput = {
        ...companyApplicationsWhere,

        ...(jobId && {
            jobId,
        }),

        ...(status && {
            status,
        }),

        ...(normalizedSearch && {
            OR: [
                {
                    applicant: {
                        firstName: {
                            contains: normalizedSearch,
                            mode: "insensitive",
                        },
                    },
                },
                {
                    applicant: {
                        lastName: {
                            contains: normalizedSearch,
                            mode: "insensitive",
                        },
                    },
                },
                {
                    applicant: {
                        email: {
                            contains: normalizedSearch,
                            mode: "insensitive",
                        },
                    },
                },
                {
                    job: {
                        title: {
                            contains: normalizedSearch,
                            mode: "insensitive",
                        },
                    },
                },
            ],
        }),
    };

    const skip = (page - 1) * limit;

    const [applications, totalItems, statusCounts, jobOptions] = await Promise.all([
        prisma.application.findMany({
            where,

            select: applicationListSelect,

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

            where: companyApplicationsWhere,

            _count: {
                _all: true,
            },
        }),

        prisma.job.findMany({
            where: {
                companyId,
                deletedAt: null,
            },

            select: {
                id: true,
                title: true,
                status: true,
            },

            orderBy: {
                title: "asc",
            },
        }),
    ]);

    function getStatusCount(applicationStatus: ApplicationStatus): number {
        return statusCounts.find((item) => item.status === applicationStatus)?._count._all ?? 0;
    }

    const totalApplications = statusCounts.reduce((total, item) => total + item._count._all, 0);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return {
        applications,

        summary: {
            totalApplications,
            submitted: getStatusCount(ApplicationStatus.SUBMITTED),
            underReview: getStatusCount(ApplicationStatus.UNDER_REVIEW),
            shortlisted: getStatusCount(ApplicationStatus.SHORTLISTED),
            interviews: getStatusCount(ApplicationStatus.INTERVIEW),
            offered: getStatusCount(ApplicationStatus.OFFERED),
            hired: getStatusCount(ApplicationStatus.HIRED),
            rejected: getStatusCount(ApplicationStatus.REJECTED),
            withdrawn: getStatusCount(ApplicationStatus.WITHDRAWN),
        },

        jobOptions,

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

export async function getCompanyApplicationById({ companyId, applicationId }: GetCompanyApplicationParameters) {
    const application = await prisma.application.findFirst({
        where: {
            id: applicationId,

            job: {
                companyId,
                deletedAt: null,
            },

            applicant: {
                deletedAt: null,
            },
        },

        select: {
            id: true,
            coverLetter: true,
            status: true,
            appliedAt: true,
            reviewedAt: true,
            withdrawnAt: true,
            createdAt: true,
            updatedAt: true,

            applicant: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    avatarUrl: true,
                    createdAt: true,

                    jobSeekerProfile: {
                        select: {
                            headline: true,
                            summary: true,
                            location: true,
                            websiteUrl: true,
                            linkedInUrl: true,
                            yearsOfExperience: true,
                        },
                    },
                },
            },

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
                    fileUrl: true,
                    mimeType: true,
                    fileSize: true,
                    createdAt: true,
                },
            },
        },
    });

    if (!application) {
        throw new AppError(404, "Application not found for this company.");
    }

    return application;
}

export async function updateCompanyApplicationStatus({
    companyId,
    applicationId,
    actorUserId,
    status,
}: UpdateCompanyApplicationStatusParameters) {
    return prisma.$transaction(async (transaction) => {
        const existingApplication = await transaction.application.findFirst({
            where: {
                id: applicationId,

                job: {
                    companyId,
                    deletedAt: null,
                },

                applicant: {
                    deletedAt: null,
                },
            },

            select: {
                id: true,
                status: true,
                reviewedAt: true,

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
                    },
                },
            },
        });

        if (!existingApplication) {
            throw new AppError(404, "Application not found for this company.");
        }

        if (existingApplication.status === ApplicationStatus.WITHDRAWN) {
            throw new AppError(409, "A withdrawn application can no longer be updated.");
        }

        if (existingApplication.status === status) {
            throw new AppError(400, `Application is already marked as ${status.toLowerCase().replaceAll("_", " ")}.`);
        }

        const previousStatus = existingApplication.status;

        const application = await transaction.application.update({
            where: {
                id: applicationId,
            },

            data: {
                status,

                reviewedAt: existingApplication.reviewedAt ?? new Date(),
            },

            select: applicationListSelect,
        });

        const applicantName =
            `${existingApplication.applicant.firstName} ${existingApplication.applicant.lastName}`.trim();

        await createCompanyAuditLog({
            transaction,
            companyId,
            actorUserId,
            action: AuditAction.APPLICATION_STATUS_CHANGED,
            entityType: AuditEntityType.APPLICATION,
            entityId: existingApplication.id,

            metadata: {
                applicationId: existingApplication.id,

                applicantId: existingApplication.applicant.id,
                applicantName,

                jobId: existingApplication.job.id,
                jobTitle: existingApplication.job.title,

                previousStatus,
                newStatus: status,
            },
        });

        return application;
    });
}
