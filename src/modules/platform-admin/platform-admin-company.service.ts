import { randomUUID } from "node:crypto";

import {
    JobStatus,
    Prisma,
} from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { createSlug } from "../../utils/slug.js";

import { createCompanyModerationNotifications } from "../notification/employer-notification.service.js";
import { runNotificationTaskSafely } from "../notification/notification.service.js";

import {
    PLATFORM_ADMIN_ACTIONS,
    PLATFORM_ADMIN_ENTITY_TYPES,
} from "./platform-admin.constants.js";
import { createPlatformAuditLog } from "./platform-audit.service.js";
import type {
    AdminCompanyCreateInput,
    AdminCompanyListQuery,
    AdminCompanySuspensionInput,
    AdminCompanyUpdateInput,
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


export async function createPlatformCompany(
    actorUserId: string,
    input: AdminCompanyCreateInput,
) {
    const baseSlug = createSlug(input.name);

    if (!baseSlug) {
        throw new AppError(400, "Company name cannot generate a valid slug.");
    }

    return prisma.$transaction(async (transaction) => {
        const conflictingCompany = await transaction.company.findUnique({
            where: { slug: baseSlug },
            select: { id: true },
        });

        const slug = conflictingCompany
            ? `${baseSlug}-${randomUUID().slice(0, 8)}`
            : baseSlug;

        const company = await transaction.company.create({
            data: {
                name: input.name,
                slug,
                description: input.description ?? null,
                websiteUrl: input.websiteUrl ?? null,
                industry: input.industry ?? null,
                companySize: input.companySize ?? null,
                location: input.location ?? null,
            },
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
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
            },
        });

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: PLATFORM_ADMIN_ACTIONS.COMPANY_CREATED_BY_ADMIN,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.COMPANY,
            entityId: company.id,
            metadata: {
                companyId: company.id,
                companyName: company.name,
                companySlug: company.slug,
                employerMembershipCreated: false,
            },
        });

        return company;
    });
}

export async function updatePlatformCompany(
    actorUserId: string,
    companyId: string,
    input: AdminCompanyUpdateInput,
) {
    return prisma.$transaction(async (transaction) => {
        await lockPlatformCompany(transaction, companyId);

        const existing = await transaction.company.findUnique({
            where: { id: companyId },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                websiteUrl: true,
                industry: true,
                companySize: true,
                location: true,
                deletedAt: true,
            },
        });

        if (!existing || existing.deletedAt) {
            throw new AppError(404, "Active company not found.");
        }

        const normalizeNullable = (value: string | null | undefined) =>
            value === undefined ? undefined : value || null;

        const description = normalizeNullable(input.description);
        const websiteUrl = normalizeNullable(input.websiteUrl);
        const industry = normalizeNullable(input.industry);
        const companySize = normalizeNullable(input.companySize);
        const location = normalizeNullable(input.location);

        const changedFields: string[] = [];
        if (input.name !== undefined && input.name !== existing.name) changedFields.push("name");
        if (description !== undefined && description !== existing.description) changedFields.push("description");
        if (websiteUrl !== undefined && websiteUrl !== existing.websiteUrl) changedFields.push("websiteUrl");
        if (industry !== undefined && industry !== existing.industry) changedFields.push("industry");
        if (companySize !== undefined && companySize !== existing.companySize) changedFields.push("companySize");
        if (location !== undefined && location !== existing.location) changedFields.push("location");

        if (changedFields.length === 0) {
            return transaction.company.findUniqueOrThrow({
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
                    createdAt: true,
                    updatedAt: true,
                    deletedAt: true,
                },
            });
        }

        const company = await transaction.company.update({
            where: { id: companyId },
            data: {
                ...(input.name !== undefined && { name: input.name }),
                ...(description !== undefined && { description }),
                ...(websiteUrl !== undefined && { websiteUrl }),
                ...(industry !== undefined && { industry }),
                ...(companySize !== undefined && { companySize }),
                ...(location !== undefined && { location }),
            },
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
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
            },
        });

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: PLATFORM_ADMIN_ACTIONS.COMPANY_UPDATED_BY_ADMIN,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.COMPANY,
            entityId: company.id,
            metadata: {
                companyId: company.id,
                companyName: company.name,
                companySlug: company.slug,
                changedFields,
            },
        });

        return company;
    });
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
    const result = await prisma.$transaction(async (transaction) => {
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

            const auditLog = await createPlatformAuditLog({
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
                company: {
                    ...company,
                    status: "SUSPENDED" as const,
                },
                notification: {
                    eventId: auditLog.id,
                    companyId: target.id,
                    companyName: target.name,
                    suspended: true,
                    reason: input.reason ?? null,
                },
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

        const auditLog = await createPlatformAuditLog({
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
            company: {
                ...company,
                status: "ACTIVE" as const,
            },
            notification: {
                eventId: auditLog.id,
                companyId: target.id,
                companyName: target.name,
                suspended: false,
                reason: previousSuspensionReason,
            },
        };
    });

    await runNotificationTaskSafely(
        `company moderation:${result.notification.eventId}`,
        () =>
            createCompanyModerationNotifications(
                result.notification,
            ),
    );

    return result.company;
}
