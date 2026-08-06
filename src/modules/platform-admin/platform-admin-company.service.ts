import {
    JobStatus,
    Prisma,
} from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import {
    PLATFORM_ADMIN_ACTIONS,
    PLATFORM_ADMIN_ENTITY_TYPES,
} from "./platform-admin.constants.js";
import { createPlatformAuditLog } from "./platform-audit.service.js";
import type {
    AdminCompanyListQuery,
    AdminCompanySuspensionInput,
    AdminCompanyVerificationInput,
} from "./platform-admin.validation.js";

const PLATFORM_COMPANY_MODERATION_LOCK_NAMESPACE = 124670858;

function getCompanyStatus(company: {
    deletedAt: Date | null;
    suspendedAt: Date | null;
}) {
    if (company.deletedAt) {
        return "DELETED" as const;
    }

    if (company.suspendedAt) {
        return "SUSPENDED" as const;
    }

    return "ACTIVE" as const;
}

async function lockPlatformCompany(
    transaction: Prisma.TransactionClient,
    companyId: string,
): Promise<void> {
    await transaction.$queryRaw<Array<{ lockResult: string }>>`
        SELECT pg_advisory_xact_lock(
            ${PLATFORM_COMPANY_MODERATION_LOCK_NAMESPACE},
            hashtext(${companyId}::text)
        )::text AS "lockResult"
    `;
}

export async function getPlatformCompanies(
    query: AdminCompanyListQuery,
) {
    const where: Prisma.CompanyWhereInput = {
        ...(query.search && {
            OR: [
                {
                    name: {
                        contains: query.search,
                        mode: "insensitive",
                    },
                },
                {
                    slug: {
                        contains: query.search,
                        mode: "insensitive",
                    },
                },
                {
                    industry: {
                        contains: query.search,
                        mode: "insensitive",
                    },
                },
                {
                    location: {
                        contains: query.search,
                        mode: "insensitive",
                    },
                },
                {
                    memberships: {
                        some: {
                            deletedAt: null,
                            user: {
                                OR: [
                                    {
                                        email: {
                                            contains: query.search,
                                            mode: "insensitive",
                                        },
                                    },
                                    {
                                        firstName: {
                                            contains: query.search,
                                            mode: "insensitive",
                                        },
                                    },
                                    {
                                        lastName: {
                                            contains: query.search,
                                            mode: "insensitive",
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            ],
        }),
        ...(query.status === "ACTIVE" && {
            deletedAt: null,
            suspendedAt: null,
        }),
        ...(query.status === "SUSPENDED" && {
            deletedAt: null,
            suspendedAt: { not: null },
        }),
        ...(query.status === "DELETED" && {
            deletedAt: { not: null },
        }),
        ...(query.verification === "VERIFIED" && {
            isVerified: true,
        }),
        ...(query.verification === "UNVERIFIED" && {
            isVerified: false,
        }),
    };

    const orderBy: Prisma.CompanyOrderByWithRelationInput[] =
        query.sort === "OLDEST"
            ? [{ createdAt: "asc" }, { id: "asc" }]
            : query.sort === "NAME_ASC"
              ? [{ name: "asc" }, { id: "asc" }]
              : query.sort === "NAME_DESC"
                ? [{ name: "desc" }, { id: "desc" }]
                : [{ createdAt: "desc" }, { id: "desc" }];

    const skip = (query.page - 1) * query.limit;

    const [companies, totalItems] = await Promise.all([
        prisma.company.findMany({
            where,
            select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                industry: true,
                companySize: true,
                location: true,
                websiteUrl: true,
                isVerified: true,
                suspendedAt: true,
                suspensionReason: true,
                suspendedById: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
                memberships: {
                    where: {
                        deletedAt: null,
                        role: "OWNER",
                    },
                    select: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                avatarUrl: true,
                            },
                        },
                    },
                    orderBy: { joinedAt: "asc" },
                    take: 1,
                },
                _count: {
                    select: {
                        memberships: {
                            where: { deletedAt: null },
                        },
                        jobs: {
                            where: { deletedAt: null },
                        },
                        invitations: true,
                    },
                },
            },
            orderBy,
            skip,
            take: query.limit,
        }),
        prisma.company.count({ where }),
    ]);

    const companyIds = companies.map((company) => company.id);

    const publishedJobCounts = companyIds.length
        ? await prisma.job.groupBy({
              by: ["companyId"],
              where: {
                  companyId: { in: companyIds },
                  deletedAt: null,
                  status: JobStatus.PUBLISHED,
              },
              _count: { _all: true },
          })
        : [];

    const publishedJobCountByCompany = new Map(
        publishedJobCounts.map((item) => [
            item.companyId,
            item._count._all,
        ]),
    );

    const totalPages = Math.max(
        1,
        Math.ceil(totalItems / query.limit),
    );

    return {
        companies: companies.map((company) => {
            const { memberships, _count, ...companyDetails } =
                company;

            return {
                ...companyDetails,
                status: getCompanyStatus(company),
                owner: memberships[0]?.user ?? null,
                counts: {
                    activeMembers: _count.memberships,
                    jobs: _count.jobs,
                    publishedJobs:
                        publishedJobCountByCompany.get(company.id) ??
                        0,
                    invitations: _count.invitations,
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

export async function getPlatformCompanyById(
    companyId: string,
) {
    const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            websiteUrl: true,
            logoUrl: true,
            bannerUrl: true,
            industry: true,
            companySize: true,
            location: true,
            isVerified: true,
            suspendedAt: true,
            suspensionReason: true,
            suspendedById: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            suspendedBy: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                },
            },
            memberships: {
                where: { deletedAt: null },
                select: {
                    id: true,
                    role: true,
                    joinedAt: true,
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            avatarUrl: true,
                            isEmailVerified: true,
                            isAdmin: true,
                            suspendedAt: true,
                            deletedAt: true,
                        },
                    },
                },
                orderBy: [
                    { role: "asc" },
                    { joinedAt: "asc" },
                ],
            },
        },
    });

    if (!company) {
        throw new AppError(404, "Company not found.");
    }

    const [
        totalJobs,
        draftJobs,
        publishedJobs,
        pausedJobs,
        closedJobs,
        archivedJobs,
        applications,
        pendingInvitations,
        companyActivity,
        platformActivity,
        recentJobs,
    ] = await Promise.all([
        prisma.job.count({
            where: { companyId, deletedAt: null },
        }),
        prisma.job.count({
            where: {
                companyId,
                deletedAt: null,
                status: JobStatus.DRAFT,
            },
        }),
        prisma.job.count({
            where: {
                companyId,
                deletedAt: null,
                status: JobStatus.PUBLISHED,
            },
        }),
        prisma.job.count({
            where: {
                companyId,
                deletedAt: null,
                status: JobStatus.PAUSED,
            },
        }),
        prisma.job.count({
            where: {
                companyId,
                deletedAt: null,
                status: JobStatus.CLOSED,
            },
        }),
        prisma.job.count({
            where: {
                companyId,
                deletedAt: null,
                status: JobStatus.ARCHIVED,
            },
        }),
        prisma.application.count({
            where: { job: { companyId } },
        }),
        prisma.companyInvitation.count({
            where: {
                companyId,
                acceptedAt: null,
                cancelledAt: null,
                expiresAt: { gt: new Date() },
            },
        }),
        prisma.auditLog.count({ where: { companyId } }),
        prisma.platformAuditLog.count({
            where: {
                entityType:
                    PLATFORM_ADMIN_ENTITY_TYPES.COMPANY,
                entityId: companyId,
            },
        }),
        prisma.job.findMany({
            where: { companyId, deletedAt: null },
            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                publishedAt: true,
                expiresAt: true,
                createdAt: true,
                updatedAt: true,
                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                _count: {
                    select: { applications: true },
                },
            },
            orderBy: [
                { updatedAt: "desc" },
                { id: "desc" },
            ],
            take: 10,
        }),
    ]);

    return {
        ...company,
        status: getCompanyStatus(company),
        counts: {
            activeMembers: company.memberships.length,
            owners: company.memberships.filter(
                (membership) => membership.role === "OWNER",
            ).length,
            jobs: {
                total: totalJobs,
                draft: draftJobs,
                published: publishedJobs,
                paused: pausedJobs,
                closed: closedJobs,
                archived: archivedJobs,
            },
            applications,
            pendingInvitations,
            companyActivity,
            platformActivity,
        },
        recentJobs: recentJobs.map((job) => {
            const { _count, ...jobDetails } = job;

            return {
                ...jobDetails,
                applicationsCount: _count.applications,
            };
        }),
    };
}

export async function updatePlatformCompanyVerification(
    actorUserId: string,
    companyId: string,
    input: AdminCompanyVerificationInput,
) {
    return prisma.$transaction(async (transaction) => {
        await lockPlatformCompany(transaction, companyId);

        const target = await transaction.company.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                name: true,
                slug: true,
                isVerified: true,
                deletedAt: true,
            },
        });

        if (!target || target.deletedAt) {
            throw new AppError(404, "Active company not found.");
        }

        if (target.isVerified === input.verified) {
            throw new AppError(
                409,
                input.verified
                    ? "This company is already verified."
                    : "This company is already unverified.",
            );
        }

        const company = await transaction.company.update({
            where: { id: companyId },
            data: { isVerified: input.verified },
            select: {
                id: true,
                name: true,
                slug: true,
                isVerified: true,
                suspendedAt: true,
                suspensionReason: true,
                suspendedById: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
            },
        });

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: input.verified
                ? PLATFORM_ADMIN_ACTIONS.COMPANY_VERIFIED
                : PLATFORM_ADMIN_ACTIONS.COMPANY_UNVERIFIED,
            entityType:
                PLATFORM_ADMIN_ENTITY_TYPES.COMPANY,
            entityId: target.id,
            metadata: {
                companyId: target.id,
                companyName: target.name,
                companySlug: target.slug,
                verified: input.verified,
            },
        });

        return {
            ...company,
            status: getCompanyStatus(company),
        };
    });
}

export async function updatePlatformCompanySuspension(
    actorUserId: string,
    companyId: string,
    input: AdminCompanySuspensionInput,
) {
    return prisma.$transaction(async (transaction) => {
        await lockPlatformCompany(transaction, companyId);

        const target = await transaction.company.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                name: true,
                slug: true,
                suspendedAt: true,
                suspensionReason: true,
                deletedAt: true,
                _count: {
                    select: {
                        memberships: {
                            where: { deletedAt: null },
                        },
                        jobs: {
                            where: { deletedAt: null },
                        },
                    },
                },
            },
        });

        if (!target || target.deletedAt) {
            throw new AppError(404, "Active company not found.");
        }

        const now = new Date();

        if (input.suspended) {
            if (target.suspendedAt) {
                throw new AppError(
                    409,
                    "This company is already suspended.",
                );
            }

            const company = await transaction.company.update({
                where: { id: companyId },
                data: {
                    suspendedAt: now,
                    suspensionReason: input.reason ?? null,
                    suspendedById: actorUserId,
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    isVerified: true,
                    suspendedAt: true,
                    suspensionReason: true,
                    suspendedById: true,
                    createdAt: true,
                    updatedAt: true,
                    deletedAt: true,
                },
            });

            await createPlatformAuditLog({
                transaction,
                actorUserId,
                action:
                    PLATFORM_ADMIN_ACTIONS.COMPANY_SUSPENDED,
                entityType:
                    PLATFORM_ADMIN_ENTITY_TYPES.COMPANY,
                entityId: target.id,
                metadata: {
                    companyId: target.id,
                    companyName: target.name,
                    companySlug: target.slug,
                    reason: input.reason ?? null,
                    activeMembers: target._count.memberships,
                    jobs: target._count.jobs,
                    jobStatusesPreserved: true,
                },
            });

            return {
                ...company,
                status: "SUSPENDED" as const,
            };
        }

        if (!target.suspendedAt) {
            throw new AppError(
                409,
                "This company is not suspended.",
            );
        }

        const previousSuspensionReason =
            target.suspensionReason;

        const company = await transaction.company.update({
            where: { id: companyId },
            data: {
                suspendedAt: null,
                suspensionReason: null,
                suspendedById: null,
            },
            select: {
                id: true,
                name: true,
                slug: true,
                isVerified: true,
                suspendedAt: true,
                suspensionReason: true,
                suspendedById: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
            },
        });

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action:
                PLATFORM_ADMIN_ACTIONS.COMPANY_RESTORED,
            entityType:
                PLATFORM_ADMIN_ENTITY_TYPES.COMPANY,
            entityId: target.id,
            metadata: {
                companyId: target.id,
                companyName: target.name,
                companySlug: target.slug,
                previousSuspensionReason,
                jobStatusesPreserved: true,
            },
        });

        return {
            ...company,
            status: "ACTIVE" as const,
        };
    });
}
