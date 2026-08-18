import { createHash, randomBytes } from "node:crypto";

import { ApplicationStatus, Prisma } from "../../generated/prisma/client.js";

import { env } from "../../config/env.js";
import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { createCoverLetterDownloadUrl } from "../job-seeker-application/application-cover-letter-storage.service.js";
import { createApplicationStatusChangedNotification } from "../notification/application-notification.service.js";
import { runNotificationTaskSafely } from "../notification/notification.service.js";
import { createResumeDownloadUrl } from "../resume/resume-storage.service.js";
import {
    PLATFORM_ADMIN_ACTIONS,
    PLATFORM_ADMIN_ENTITY_TYPES,
} from "./platform-admin.constants.js";
import { createPlatformAuditLog } from "./platform-audit.service.js";
import type {
    AdminApplicationListQuery,
    AdminApplicationShareCreateInput,
    AdminApplicationStatusInput,
} from "./platform-admin.validation.js";

const ADMIN_MANAGEABLE_STATUSES = new Set<ApplicationStatus>([
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.INTERVIEW,
    ApplicationStatus.OFFERED,
    ApplicationStatus.HIRED,
    ApplicationStatus.REJECTED,
]);

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
            deletedAt: true,
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
            company: {
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
        },
    },
} satisfies Prisma.ApplicationSelect;

function serializeApplicant<
    T extends {
        applicant: {
            deletedAt: Date | null;
            email: string;
            phone: string | null;
            avatarUrl: string | null;
            firstName: string;
            lastName: string;
            jobSeekerProfile: unknown;
        };
    },
>(application: T) {
    if (!application.applicant.deletedAt) {
        const { deletedAt: _deletedAt, ...applicant } = application.applicant;
        return {
            ...application,
            applicant: { ...applicant, isDeleted: false as const },
        };
    }

    const { deletedAt: _deletedAt, ...restApplicant } = application.applicant;
    return {
        ...application,
        applicant: {
            ...restApplicant,
            firstName: "Deleted",
            lastName: "User",
            email: null,
            phone: null,
            avatarUrl: null,
            jobSeekerProfile: null,
            isDeleted: true as const,
        },
    };
}

function getStatusCount(
    statusCounts: Array<{ status: ApplicationStatus; _count: { _all: number } }>,
    status: ApplicationStatus,
): number {
    return statusCounts.find((item) => item.status === status)?._count._all ?? 0;
}

export async function getPlatformApplications(query: AdminApplicationListQuery) {
    const normalizedSearch = query.search?.trim() ?? "";
    const where: Prisma.ApplicationWhereInput = {
        ...(query.status !== "ALL" && { status: query.status }),
        ...(query.jobId && { jobId: query.jobId }),
        ...(query.companyId && {
            job: {
                companyId: query.companyId,
            },
        }),
        ...(normalizedSearch && {
            OR: [
                { applicant: { firstName: { contains: normalizedSearch, mode: "insensitive" } } },
                { applicant: { lastName: { contains: normalizedSearch, mode: "insensitive" } } },
                { applicant: { email: { contains: normalizedSearch, mode: "insensitive" } } },
                { job: { title: { contains: normalizedSearch, mode: "insensitive" } } },
                { job: { company: { name: { contains: normalizedSearch, mode: "insensitive" } } } },
            ],
        }),
    };

    const skip = (query.page - 1) * query.limit;
    const [applications, totalItems, statusCounts, jobs] = await Promise.all([
        prisma.application.findMany({
            where,
            select: applicationListSelect,
            orderBy: query.sort === "OLDEST"
                ? [{ appliedAt: "asc" }, { id: "asc" }]
                : [{ appliedAt: "desc" }, { id: "desc" }],
            skip,
            take: query.limit,
        }),
        prisma.application.count({ where }),
        prisma.application.groupBy({
            by: ["status"],
            _count: { _all: true },
        }),
        prisma.job.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                title: true,
                company: { select: { id: true, name: true } },
            },
            orderBy: [{ company: { name: "asc" } }, { title: "asc" }],
        }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));

    return {
        applications: applications.map(serializeApplicant),
        summary: {
            total: statusCounts.reduce((sum, item) => sum + item._count._all, 0),
            submitted: getStatusCount(statusCounts, ApplicationStatus.SUBMITTED),
            underReview: getStatusCount(statusCounts, ApplicationStatus.UNDER_REVIEW),
            interview: getStatusCount(statusCounts, ApplicationStatus.INTERVIEW),
            offered: getStatusCount(statusCounts, ApplicationStatus.OFFERED),
            hired: getStatusCount(statusCounts, ApplicationStatus.HIRED),
            notSelected: getStatusCount(statusCounts, ApplicationStatus.REJECTED),
            withdrawn: getStatusCount(statusCounts, ApplicationStatus.WITHDRAWN),
            legacyShortlisted: getStatusCount(statusCounts, ApplicationStatus.SHORTLISTED),
        },
        jobOptions: jobs,
        pagination: {
            page: query.page,
            limit: query.limit,
            totalItems,
            totalPages,
            hasNextPage: query.page < totalPages,
            hasPreviousPage: query.page > 1,
        },
    };
}

export async function getPlatformApplicationById(applicationId: string) {
    const application = await prisma.application.findUnique({
        where: { id: applicationId },
        select: {
            id: true,
            coverLetter: true,
            coverLetterFileName: true,
            coverLetterFileMimeType: true,
            coverLetterFileSize: true,
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
                    deletedAt: true,
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
                    company: { select: { id: true, name: true, slug: true } },
                    category: { select: { id: true, name: true, slug: true } },
                },
            },
            resume: {
                select: {
                    id: true,
                    name: true,
                    mimeType: true,
                    fileSize: true,
                    createdAt: true,
                    deletedAt: true,
                },
            },
            shareLinks: {
                select: {
                    id: true,
                    includeResume: true,
                    includeCoverLetter: true,
                    expiresAt: true,
                    revokedAt: true,
                    lastAccessedAt: true,
                    accessCount: true,
                    createdAt: true,
                    createdBy: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                take: 20,
            },
        },
    });

    if (!application) {
        throw new AppError(404, "Application not found.");
    }

    return serializeApplicant(application);
}

async function getApplicationFileContext(applicationId: string) {
    const application = await prisma.application.findUnique({
        where: { id: applicationId },
        select: {
            id: true,
            applicant: { select: { deletedAt: true } },
            resume: {
                select: {
                    id: true,
                    name: true,
                    fileKey: true,
                    mimeType: true,
                    fileSize: true,
                },
            },
            coverLetterFileKey: true,
            coverLetterFileName: true,
            coverLetterFileMimeType: true,
            coverLetterFileSize: true,
        },
    });

    if (!application) {
        throw new AppError(404, "Application not found.");
    }
    if (application.applicant.deletedAt) {
        throw new AppError(410, "Applicant account is no longer available.");
    }
    return application;
}

export async function getPlatformApplicationResumeDownload(applicationId: string) {
    const application = await getApplicationFileContext(applicationId);
    if (!application.resume) {
        throw new AppError(404, "No resume is attached to this application.");
    }

    return {
        resume: {
            id: application.resume.id,
            name: application.resume.name,
            mimeType: application.resume.mimeType,
            fileSize: application.resume.fileSize,
        },
        downloadUrl: await createResumeDownloadUrl({ fileKey: application.resume.fileKey }),
        expiresInSeconds: 5 * 60,
    };
}

export async function getPlatformApplicationCoverLetterDownload(applicationId: string) {
    const application = await getApplicationFileContext(applicationId);
    if (
        !application.coverLetterFileKey ||
        !application.coverLetterFileName ||
        !application.coverLetterFileMimeType ||
        application.coverLetterFileSize === null
    ) {
        throw new AppError(404, "No cover letter file is attached to this application.");
    }

    return {
        coverLetterFile: {
            name: application.coverLetterFileName,
            mimeType: application.coverLetterFileMimeType,
            fileSize: application.coverLetterFileSize,
        },
        downloadUrl: await createCoverLetterDownloadUrl({ fileKey: application.coverLetterFileKey }),
        expiresInSeconds: 5 * 60,
    };
}

export async function updatePlatformApplicationStatus(
    actorUserId: string,
    applicationId: string,
    input: AdminApplicationStatusInput,
) {
    if (!ADMIN_MANAGEABLE_STATUSES.has(input.status)) {
        throw new AppError(400, "This application status cannot be assigned by Platform Admin.");
    }

    const result = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.application.findUnique({
            where: { id: applicationId },
            select: {
                id: true,
                status: true,
                reviewedAt: true,
                applicant: { select: { id: true, firstName: true, lastName: true, deletedAt: true } },
                job: {
                    select: {
                        id: true,
                        title: true,
                        company: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (!existing) throw new AppError(404, "Application not found.");
        if (existing.applicant.deletedAt) throw new AppError(410, "Applicant account is no longer available.");
        if (existing.status === ApplicationStatus.WITHDRAWN) {
            throw new AppError(409, "A withdrawn application can no longer be updated.");
        }
        if (existing.status === input.status) {
            throw new AppError(400, "Application already has this status.");
        }

        const application = await transaction.application.update({
            where: { id: applicationId },
            data: {
                status: input.status,
                reviewedAt: existing.reviewedAt ?? new Date(),
            },
            select: applicationListSelect,
        });

        const applicantName = `${existing.applicant.firstName} ${existing.applicant.lastName}`.trim();
        const audit = await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: PLATFORM_ADMIN_ACTIONS.APPLICATION_STATUS_CHANGED_BY_ADMIN,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.APPLICATION,
            entityId: existing.id,
            metadata: {
                applicationId: existing.id,
                applicantId: existing.applicant.id,
                applicantName,
                jobId: existing.job.id,
                jobTitle: existing.job.title,
                companyId: existing.job.company.id,
                companyName: existing.job.company.name,
                previousStatus: existing.status,
                newStatus: input.status,
            },
        });

        return {
            application,
            notificationContext: {
                applicationId: existing.id,
                applicantId: existing.applicant.id,
                applicantName,
                jobId: existing.job.id,
                jobTitle: existing.job.title,
                companyId: existing.job.company.id,
                companyName: existing.job.company.name,
                previousStatus: existing.status,
                newStatus: input.status,
                eventId: audit.id,
            },
        };
    });

    await runNotificationTaskSafely(
        `admin application status changed (${applicationId})`,
        () => createApplicationStatusChangedNotification({ client: prisma, ...result.notificationContext }),
    );

    return serializeApplicant(result.application);
}

function hashShareToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

export async function createPlatformApplicationShareLink(
    actorUserId: string,
    applicationId: string,
    input: AdminApplicationShareCreateInput,
) {
    const application = await prisma.application.findUnique({
        where: { id: applicationId },
        select: {
            id: true,
            applicant: { select: { deletedAt: true } },
            resume: { select: { id: true } },
            coverLetter: true,
            coverLetterFileKey: true,
        },
    });

    if (!application) throw new AppError(404, "Application not found.");
    if (application.applicant.deletedAt) throw new AppError(410, "Applicant account is no longer available.");
    if (!input.includeResume && !input.includeCoverLetter) {
        throw new AppError(400, "Select at least one application document to share.");
    }
    if (input.includeResume && !application.resume) {
        throw new AppError(400, "This application does not have a resume to share.");
    }
    if (input.includeCoverLetter && !application.coverLetter && !application.coverLetterFileKey) {
        throw new AppError(400, "This application does not have a cover letter to share.");
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashShareToken(token);
    const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000);

    const shareLink = await prisma.$transaction(async (transaction) => {
        const created = await transaction.applicationShareLink.create({
            data: {
                applicationId,
                createdById: actorUserId,
                tokenHash,
                includeResume: input.includeResume,
                includeCoverLetter: input.includeCoverLetter,
                expiresAt,
            },
            select: {
                id: true,
                includeResume: true,
                includeCoverLetter: true,
                expiresAt: true,
                revokedAt: true,
                accessCount: true,
                lastAccessedAt: true,
                createdAt: true,
            },
        });

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: PLATFORM_ADMIN_ACTIONS.APPLICATION_SHARE_LINK_CREATED,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.APPLICATION,
            entityId: applicationId,
            metadata: {
                applicationId,
                shareLinkId: created.id,
                includeResume: created.includeResume,
                includeCoverLetter: created.includeCoverLetter,
                expiresAt: created.expiresAt.toISOString(),
            },
        });

        return created;
    });

    const sharePath = `/application-share/${token}`;
    return {
        ...shareLink,
        sharePath,
        shareUrl: `${env.FRONTEND_URL}${sharePath}`,
    };
}

export async function revokePlatformApplicationShareLink(
    actorUserId: string,
    applicationId: string,
    shareLinkId: string,
) {
    return prisma.$transaction(async (transaction) => {
        const existing = await transaction.applicationShareLink.findFirst({
            where: { id: shareLinkId, applicationId },
            select: { id: true, revokedAt: true, expiresAt: true },
        });
        if (!existing) throw new AppError(404, "Application share link not found.");
        if (existing.revokedAt) throw new AppError(409, "Application share link is already revoked.");

        const shareLink = await transaction.applicationShareLink.update({
            where: { id: existing.id },
            data: { revokedAt: new Date() },
            select: {
                id: true,
                includeResume: true,
                includeCoverLetter: true,
                expiresAt: true,
                revokedAt: true,
                accessCount: true,
                lastAccessedAt: true,
                createdAt: true,
            },
        });

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: PLATFORM_ADMIN_ACTIONS.APPLICATION_SHARE_LINK_REVOKED,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.APPLICATION,
            entityId: applicationId,
            metadata: { applicationId, shareLinkId: shareLink.id },
        });

        return shareLink;
    });
}

export { hashShareToken };
