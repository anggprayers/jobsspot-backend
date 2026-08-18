import { ApplicationStatus, JobStatus, Prisma } from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import { archiveJob, createJob, publishJob, unpublishJob, updateJob } from "../job/job.service.js";

import { createJobModerationNotifications } from "../notification/employer-notification.service.js";
import { runNotificationTaskSafely } from "../notification/notification.service.js";

import {
    PLATFORM_ADMIN_ACTIONS,
    PLATFORM_ADMIN_ENTITY_TYPES,
} from "./platform-admin.constants.js";
import { createPlatformAuditLog } from "./platform-audit.service.js";
import type {
    AdminJobCreateInput,
    AdminJobListQuery,
    AdminJobModerationInput,
    AdminJobPublishInput,
    AdminJobUpdateInput,
} from "./platform-admin.validation.js";

const PLATFORM_JOB_MODERATION_LOCK_NAMESPACE = 731904112;
const ADMIN_DEFAULT_APPLICATION_WINDOW_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;


async function createStandalonePlatformJobAudit(
    actorUserId: string,
    action: Parameters<typeof createPlatformAuditLog>[0]["action"],
    entityId: string,
    metadata: Prisma.InputJsonValue,
) {
    return prisma.$transaction((transaction) =>
        createPlatformAuditLog({
            transaction,
            actorUserId,
            action,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.JOB,
            entityId,
            metadata,
        }),
    );
}

function getDefaultAdminApplicationDeadline(now = new Date()) {
    return new Date(
        now.getTime() +
            ADMIN_DEFAULT_APPLICATION_WINDOW_DAYS * MILLISECONDS_PER_DAY,
    );
}

async function getActivePlatformJobCompany(jobId: string) {
    const job = await prisma.job.findFirst({
        where: { id: jobId, deletedAt: null },
        select: {
            id: true,
            companyId: true,
            title: true,
            slug: true,
            status: true,
            applicationDeadline: true,
            company: {
                select: {
                    id: true,
                    name: true,
                    suspendedAt: true,
                    deletedAt: true,
                },
            },
        },
    });

    if (!job) {
        throw new AppError(404, "Active job not found.");
    }

    return job;
}

export async function createPlatformJob(
    actorUserId: string,
    input: AdminJobCreateInput,
) {
    const company = await prisma.company.findFirst({
        where: {
            id: input.companyId,
            deletedAt: null,
        },
        select: {
            id: true,
            name: true,
            suspendedAt: true,
        },
    });

    if (!company) {
        throw new AppError(404, "Active company not found.");
    }

    if (company.suspendedAt) {
        throw new AppError(409, "Restore the company before creating a new job for it.");
    }

    const job = await createJob({
        companyId: company.id,
        actorUserId,
        data: input.job,
    });

    await createStandalonePlatformJobAudit(
        actorUserId,
        PLATFORM_ADMIN_ACTIONS.JOB_CREATED_BY_ADMIN,
        job.id,
        {
    jobId: job.id,
    jobTitle: job.title,
    jobSlug: job.slug,
    companyId: company.id,
    companyName: company.name,
    status: job.status,
},
    );

    return job;
}

export async function updatePlatformJob(
    actorUserId: string,
    jobId: string,
    input: AdminJobUpdateInput,
) {
    const target = await getActivePlatformJobCompany(jobId);

    const job = await updateJob({
        companyId: target.companyId,
        jobId,
        actorUserId,
        data: input,
    });

    await createStandalonePlatformJobAudit(
        actorUserId,
        PLATFORM_ADMIN_ACTIONS.JOB_UPDATED_BY_ADMIN,
        job.id,
        {
    jobId: job.id,
    jobTitle: job.title,
    jobSlug: job.slug,
    companyId: target.companyId,
    companyName: target.company.name,
    changedFields: Object.keys(input),
},
    );

    return job;
}

export async function publishPlatformManagedJob(
    actorUserId: string,
    jobId: string,
    input: AdminJobPublishInput,
) {
    const target = await getActivePlatformJobCompany(jobId);
    const now = new Date();

    if (target.company.deletedAt || target.company.suspendedAt) {
        throw new AppError(409, "Restore the company before publishing this job.");
    }

    const existingFutureDeadline =
        target.applicationDeadline && target.applicationDeadline > now
            ? target.applicationDeadline
            : null;

    const applicationDeadline =
        input.applicationDeadline ??
        existingFutureDeadline ??
        getDefaultAdminApplicationDeadline(now);

    await updateJob({
        companyId: target.companyId,
        jobId,
        actorUserId,
        data: { applicationDeadline },
    });

    const job = await publishJob({
        companyId: target.companyId,
        jobId,
        actorUserId,
    });

    await createStandalonePlatformJobAudit(
        actorUserId,
        PLATFORM_ADMIN_ACTIONS.JOB_PUBLISHED_BY_ADMIN,
        job.id,
        {
    jobId: job.id,
    jobTitle: job.title,
    jobSlug: job.slug,
    companyId: target.companyId,
    companyName: target.company.name,
    applicationDeadline: applicationDeadline.toISOString(),
    defaultDeadlineApplied:
        input.applicationDeadline === undefined &&
        existingFutureDeadline === null,
},
    );

    return job;
}

export async function archivePlatformManagedJob(
    actorUserId: string,
    jobId: string,
) {
    const target = await getActivePlatformJobCompany(jobId);
    const previousStatus = target.status;

    if (target.status === JobStatus.PUBLISHED) {
        await unpublishJob({
            companyId: target.companyId,
            jobId,
            actorUserId,
        });
    }

    const job = await archiveJob({
        companyId: target.companyId,
        jobId,
        actorUserId,
    });

    await createStandalonePlatformJobAudit(
        actorUserId,
        PLATFORM_ADMIN_ACTIONS.JOB_ARCHIVED_BY_ADMIN,
        job.id,
        {
    jobId: job.id,
    jobTitle: job.title,
    jobSlug: job.slug,
    companyId: target.companyId,
    companyName: target.company.name,
    previousStatus,
    newStatus: job.status,
},
    );

    return job;
}


async function lockPlatformJob(
    transaction: Prisma.TransactionClient,
    jobId: string,
): Promise<void> {
    await transaction.$queryRaw<Array<{ lockResult: string }>>`
        SELECT pg_advisory_xact_lock(
            ${PLATFORM_JOB_MODERATION_LOCK_NAMESPACE},
            hashtext(${jobId}::text)
        )::text AS "lockResult"
    `;
}

function getModerationStatus(job: { adminHiddenAt: Date | null }) {
    return job.adminHiddenAt ? ("HIDDEN" as const) : ("VISIBLE" as const);
}

export async function getPlatformJobs(query: AdminJobListQuery) {
    const where: Prisma.JobWhereInput = {
        ...(query.search && {
            OR: [
                { title: { contains: query.search, mode: "insensitive" } },
                { slug: { contains: query.search, mode: "insensitive" } },
                { location: { contains: query.search, mode: "insensitive" } },
                { company: { name: { contains: query.search, mode: "insensitive" } } },
                { category: { name: { contains: query.search, mode: "insensitive" } } },
            ],
        }),
        ...(query.status !== "ALL" && { status: query.status }),
        ...(query.moderation === "VISIBLE" && { adminHiddenAt: null }),
        ...(query.moderation === "HIDDEN" && { adminHiddenAt: { not: null } }),
        ...(query.companyId && { companyId: query.companyId }),
        ...(query.recordState === "ACTIVE" && { deletedAt: null }),
        ...(query.recordState === "DELETED" && { deletedAt: { not: null } }),
    };

    const orderBy: Prisma.JobOrderByWithRelationInput[] =
        query.sort === "OLDEST"
            ? [{ createdAt: "asc" }, { id: "asc" }]
            : query.sort === "TITLE_ASC"
              ? [{ title: "asc" }, { id: "asc" }]
              : query.sort === "TITLE_DESC"
                ? [{ title: "desc" }, { id: "desc" }]
                : [{ createdAt: "desc" }, { id: "desc" }];

    const skip = (query.page - 1) * query.limit;

    const [jobs, totalItems] = await Promise.all([
        prisma.job.findMany({
            where,
            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                employmentType: true,
                workplaceType: true,
                experienceLevel: true,
                location: true,
                publishedAt: true,
                expiresAt: true,
                adminHiddenAt: true,
                adminHiddenReason: true,
                adminHiddenById: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
                company: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        logoUrl: true,
                        suspendedAt: true,
                        deletedAt: true,
                    },
                },
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
                _count: {
                    select: {
                        applications: true,
                        reports: true,
                    },
                },
            },
            orderBy,
            skip,
            take: query.limit,
        }),
        prisma.job.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));

    return {
        jobs: jobs.map((job) => {
            const { _count, ...details } = job;
            return {
                ...details,
                moderationStatus: getModerationStatus(job),
                counts: {
                    applications: _count.applications,
                    reports: _count.reports,
                },
            };
        }),
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

export async function getPlatformJobById(jobId: string) {
    const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: {
            id: true,
            companyId: true,
            categoryId: true,
            createdById: true,
            title: true,
            slug: true,
            description: true,
            requirements: true,
            preferredQualifications: true,
            responsibilities: true,
            employmentType: true,
            workplaceType: true,
            experienceLevel: true,
            location: true,
            city: true,
            stateRegion: true,
            countryCode: true,
            salaryMin: true,
            salaryMax: true,
            salaryCurrency: true,
            salaryPeriod: true,
            status: true,
            applicationDeadline: true,
            publicContactEmail: true,
            publishedAt: true,
            expiresAt: true,
            adminHiddenAt: true,
            adminHiddenReason: true,
            adminHiddenById: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            company: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                    isVerified: true,
                    suspendedAt: true,
                    deletedAt: true,
                },
            },
            category: {
                select: { id: true, name: true, slug: true },
            },
            createdBy: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                },
            },
            adminHiddenBy: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                },
            },
            reports: {
                select: {
                    id: true,
                    reason: true,
                    status: true,
                    createdAt: true,
                    reporter: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                        },
                    },
                },
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                take: 10,
            },
        },
    });

    if (!job) {
        throw new AppError(404, "Job not found.");
    }

    const statusCounts = await prisma.application.groupBy({
        by: ["status"],
        where: { jobId },
        _count: { _all: true },
    });

    const reportsByStatus = await prisma.jobReport.groupBy({
        by: ["status"],
        where: { jobId },
        _count: { _all: true },
    });

    const applicationCounts = Object.fromEntries(
        Object.values(ApplicationStatus).map((status) => [
            status,
            statusCounts.find((item) => item.status === status)?._count._all ?? 0,
        ]),
    );

    return {
        ...job,
        moderationStatus: getModerationStatus(job),
        counts: {
            applications: statusCounts.reduce((sum, item) => sum + item._count._all, 0),
            applicationsByStatus: applicationCounts,
            reports: reportsByStatus.reduce((sum, item) => sum + item._count._all, 0),
            pendingReports:
                reportsByStatus.find((item) => item.status === "PENDING")?._count._all ?? 0,
            underReviewReports:
                reportsByStatus.find((item) => item.status === "UNDER_REVIEW")?._count._all ?? 0,
        },
    };
}

export async function updatePlatformJobModeration(
    actorUserId: string,
    jobId: string,
    input: AdminJobModerationInput,
) {
    const result = await prisma.$transaction(async (transaction) => {
        await lockPlatformJob(transaction, jobId);

        const target = await transaction.job.findUnique({
            where: { id: jobId },
            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                adminHiddenAt: true,
                adminHiddenReason: true,
                deletedAt: true,
                company: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!target || target.deletedAt) {
            throw new AppError(404, "Active job not found.");
        }

        if (input.hidden && target.adminHiddenAt) {
            throw new AppError(409, "This job is already hidden by JobsSpot.");
        }

        if (!input.hidden && !target.adminHiddenAt) {
            throw new AppError(409, "This job is not hidden by JobsSpot.");
        }

        const previousReason = target.adminHiddenReason;
        const now = new Date();

        const job = await transaction.job.update({
            where: { id: jobId },
            data: input.hidden
                ? {
                      adminHiddenAt: now,
                      adminHiddenReason: input.reason ?? null,
                      adminHiddenById: actorUserId,
                  }
                : {
                      adminHiddenAt: null,
                      adminHiddenReason: null,
                      adminHiddenById: null,
                  },
            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                adminHiddenAt: true,
                adminHiddenReason: true,
                adminHiddenById: true,
                updatedAt: true,
            },
        });

        const audit = await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: input.hidden
                ? PLATFORM_ADMIN_ACTIONS.JOB_HIDDEN
                : PLATFORM_ADMIN_ACTIONS.JOB_RESTORED,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.JOB,
            entityId: target.id,
            metadata: {
                jobId: target.id,
                jobTitle: target.title,
                jobSlug: target.slug,
                companyId: target.company.id,
                companyName: target.company.name,
                jobStatusPreserved: target.status,
                reason: input.hidden ? input.reason ?? null : previousReason,
            },
        });

        return {
            job: {
                ...job,
                moderationStatus: getModerationStatus(job),
            },
            notification: {
                eventId: audit.id,
                jobId: target.id,
                jobTitle: target.title,
                companyId: target.company.id,
                companyName: target.company.name,
                hidden: input.hidden,
                reason: input.hidden ? input.reason ?? null : previousReason,
            },
        };
    });

    await runNotificationTaskSafely(`job moderation:${result.notification.eventId}`, () =>
        createJobModerationNotifications(result.notification),
    );

    return result.job;
}
