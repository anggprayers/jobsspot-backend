import {
    JobReportStatus,
    Prisma,
} from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import { createReporterJobReportUpdateNotification } from "../notification/job-report-notification.service.js";
import { runNotificationTaskSafely } from "../notification/notification.service.js";

import {
    PLATFORM_ADMIN_ACTIONS,
    PLATFORM_ADMIN_ENTITY_TYPES,
} from "./platform-admin.constants.js";
import { createPlatformAuditLog } from "./platform-audit.service.js";
import type {
    AdminJobReportListQuery,
    AdminJobReportStatusInput,
} from "./platform-admin.validation.js";

export async function getPlatformJobReports(query: AdminJobReportListQuery) {
    const where: Prisma.JobReportWhereInput = {
        ...(query.search && {
            OR: [
                { job: { title: { contains: query.search, mode: "insensitive" } } },
                { job: { company: { name: { contains: query.search, mode: "insensitive" } } } },
                { reporter: { email: { contains: query.search, mode: "insensitive" } } },
                { reporter: { firstName: { contains: query.search, mode: "insensitive" } } },
                { reporter: { lastName: { contains: query.search, mode: "insensitive" } } },
            ],
        }),
        ...(query.status !== "ALL" && { status: query.status }),
        ...(query.reason !== "ALL" && { reason: query.reason }),
    };

    const orderBy: Prisma.JobReportOrderByWithRelationInput[] =
        query.sort === "OLDEST"
            ? [{ createdAt: "asc" }, { id: "asc" }]
            : [{ createdAt: "desc" }, { id: "desc" }];
    const skip = (query.page - 1) * query.limit;

    const [reports, totalItems] = await Promise.all([
        prisma.jobReport.findMany({
            where,
            select: {
                id: true,
                reason: true,
                details: true,
                status: true,
                resolutionNote: true,
                reviewedAt: true,
                createdAt: true,
                updatedAt: true,
                job: {
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
                                slug: true,
                                logoUrl: true,
                            },
                        },
                    },
                },
                reporter: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarUrl: true,
                    },
                },
                reviewedBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
            orderBy,
            skip,
            take: query.limit,
        }),
        prisma.jobReport.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));

    return {
        reports,
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

export async function getPlatformJobReportById(reportId: string) {
    const report = await prisma.jobReport.findUnique({
        where: { id: reportId },
        select: {
            id: true,
            reason: true,
            details: true,
            status: true,
            resolutionNote: true,
            reviewedAt: true,
            createdAt: true,
            updatedAt: true,
            reporter: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                    isEmailVerified: true,
                    suspendedAt: true,
                    deletedAt: true,
                },
            },
            reviewedBy: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                },
            },
            job: {
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    description: true,
                    requirements: true,
                            preferredQualifications: true,
                    responsibilities: true,
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
                    _count: {
                        select: {
                            applications: true,
                            reports: true,
                        },
                    },
                },
            },
        },
    });

    if (!report) {
        throw new AppError(404, "Job report not found.");
    }

    return report;
}

export async function updatePlatformJobReportStatus(
    actorUserId: string,
    reportId: string,
    input: AdminJobReportStatusInput,
) {
    const result = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.jobReport.findUnique({
            where: { id: reportId },
            select: {
                id: true,
                status: true,
                reporterUserId: true,
                reason: true,
                resolutionNote: true,
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

        if (!existing) {
            throw new AppError(404, "Job report not found.");
        }

        if (existing.status === input.status && (input.resolutionNote ?? null) === existing.resolutionNote) {
            throw new AppError(409, "This report already has that moderation status.");
        }

        const now = new Date();
        const isFinal =
            input.status === JobReportStatus.RESOLVED ||
            input.status === JobReportStatus.DISMISSED;

        const report = await transaction.jobReport.update({
            where: { id: reportId },
            data: {
                status: input.status,
                resolutionNote: isFinal ? input.resolutionNote ?? null : null,
                reviewedById: actorUserId,
                reviewedAt: now,
            },
            select: {
                id: true,
                reason: true,
                details: true,
                status: true,
                resolutionNote: true,
                reviewedAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        const action =
            input.status === JobReportStatus.UNDER_REVIEW
                ? PLATFORM_ADMIN_ACTIONS.JOB_REPORT_REVIEW_STARTED
                : input.status === JobReportStatus.RESOLVED
                  ? PLATFORM_ADMIN_ACTIONS.JOB_REPORT_RESOLVED
                  : input.status === JobReportStatus.DISMISSED
                    ? PLATFORM_ADMIN_ACTIONS.JOB_REPORT_DISMISSED
                    : PLATFORM_ADMIN_ACTIONS.JOB_REPORT_REVIEW_STARTED;

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.JOB_REPORT,
            entityId: existing.id,
            metadata: {
                reportId: existing.id,
                jobId: existing.job.id,
                jobTitle: existing.job.title,
                companyId: existing.job.company.id,
                companyName: existing.job.company.name,
                reportReason: existing.reason,
                previousStatus: existing.status,
                newStatus: input.status,
                resolutionNote: input.resolutionNote ?? null,
            },
        });

        return {
            report,
            notification:
                input.status === JobReportStatus.RESOLVED || input.status === JobReportStatus.DISMISSED
                    ? {
                          reportId: existing.id,
                          reporterUserId: existing.reporterUserId,
                          jobId: existing.job.id,
                          jobTitle: existing.job.title,
                          status: input.status,
                      }
                    : null,
        };
    });

    const notification = result.notification;

    if (notification) {
        await runNotificationTaskSafely(`job report update:${notification.reportId}`, () =>
            createReporterJobReportUpdateNotification(notification),
        );
    }

    return result.report;
}
