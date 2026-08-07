import type { Prisma } from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import {
    PLATFORM_ADMIN_ACTIONS,
    PLATFORM_ADMIN_ENTITY_TYPES,
} from "./platform-admin.constants.js";
import { createPlatformAuditLog } from "./platform-audit.service.js";
import type {
    AdminUserListQuery,
    AdminUserSuspensionInput,
} from "./platform-admin.validation.js";

function getUserStatus(user: {
    deletedAt: Date | null;
    suspendedAt: Date | null;
}) {
    if (user.deletedAt) {
        return "DELETED" as const;
    }

    if (user.suspendedAt) {
        return "SUSPENDED" as const;
    }

    return "ACTIVE" as const;
}

export async function getPlatformAdminDashboard() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
        totalUsers,
        activeUsers,
        suspendedUsers,
        newUsersLast30Days,
        totalCompanies,
        verifiedCompanies,
        suspendedCompanies,
        totalJobs,
        publishedJobs,
        hiddenJobs,
        totalJobReports,
        pendingJobReports,
        underReviewJobReports,
        totalApplications,
        newApplicationsLast30Days,
        totalCategories,
        activeCategories,
    ] = await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { deletedAt: null, suspendedAt: null } }),
        prisma.user.count({ where: { deletedAt: null, suspendedAt: { not: null } } }),
        prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null } }),
        prisma.company.count({ where: { deletedAt: null } }),
        prisma.company.count({ where: { deletedAt: null, suspendedAt: null, isVerified: true } }),
        prisma.company.count({ where: { deletedAt: null, suspendedAt: { not: null } } }),
        prisma.job.count({ where: { deletedAt: null } }),
        prisma.job.count({
            where: {
                deletedAt: null,
                status: "PUBLISHED",
                adminHiddenAt: null,
                company: { deletedAt: null, suspendedAt: null },
                category: { isActive: true },
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: now } },
                ],
            },
        }),
        prisma.job.count({ where: { deletedAt: null, adminHiddenAt: { not: null } } }),
        prisma.jobReport.count(),
        prisma.jobReport.count({ where: { status: "PENDING" } }),
        prisma.jobReport.count({ where: { status: "UNDER_REVIEW" } }),
        prisma.application.count(),
        prisma.application.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.jobCategory.count(),
        prisma.jobCategory.count({ where: { isActive: true } }),
    ]);

    return {
        generatedAt: now,
        users: {
            total: totalUsers,
            active: activeUsers,
            suspended: suspendedUsers,
            newLast30Days: newUsersLast30Days,
        },
        companies: {
            total: totalCompanies,
            verified: verifiedCompanies,
            suspended: suspendedCompanies,
        },
        jobs: {
            total: totalJobs,
            published: publishedJobs,
            hidden: hiddenJobs,
        },
        jobReports: {
            total: totalJobReports,
            pending: pendingJobReports,
            underReview: underReviewJobReports,
        },
        applications: {
            total: totalApplications,
            newLast30Days: newApplicationsLast30Days,
        },
        categories: {
            total: totalCategories,
            active: activeCategories,
        },
    };
}

export async function getPlatformUsers(query: AdminUserListQuery) {
    const where: Prisma.UserWhereInput = {
        ...(query.search && {
            OR: [
                { email: { contains: query.search, mode: "insensitive" } },
                { firstName: { contains: query.search, mode: "insensitive" } },
                { lastName: { contains: query.search, mode: "insensitive" } },
            ],
        }),
        ...(query.status === "ACTIVE" && { deletedAt: null, suspendedAt: null }),
        ...(query.status === "SUSPENDED" && {
            deletedAt: null,
            suspendedAt: { not: null },
        }),
        ...(query.status === "DELETED" && { deletedAt: { not: null } }),
        ...(query.accountType === "ADMIN" && { isAdmin: true }),
        ...(query.accountType === "STANDARD" && { isAdmin: false }),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput[] =
        query.sort === "OLDEST"
            ? [{ createdAt: "asc" }, { id: "asc" }]
            : query.sort === "NAME_ASC"
              ? [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }]
              : query.sort === "NAME_DESC"
                ? [{ firstName: "desc" }, { lastName: "desc" }, { id: "desc" }]
                : [{ createdAt: "desc" }, { id: "desc" }];

    const skip = (query.page - 1) * query.limit;

    const [users, totalItems] = await Promise.all([
        prisma.user.findMany({
            where,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
                isEmailVerified: true,
                isAdmin: true,
                suspendedAt: true,
                suspensionReason: true,
                suspendedById: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
                _count: {
                    select: {
                        companyMemberships: { where: { deletedAt: null } },
                        applications: true,
                        resumes: { where: { deletedAt: null } },
                    },
                },
            },
            orderBy,
            skip,
            take: query.limit,
        }),
        prisma.user.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));

    return {
        users: users.map((user) => {
            const { _count, ...userDetails } = user;

            return {
                ...userDetails,
                status: getUserStatus(user),
                counts: {
                    companyMemberships: _count.companyMemberships,
                    applications: _count.applications,
                    resumes: _count.resumes,
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

export async function getPlatformUserById(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            isEmailVerified: true,
            isAdmin: true,
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
            companyMemberships: {
                where: { deletedAt: null },
                select: {
                    id: true,
                    role: true,
                    joinedAt: true,
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
                },
                orderBy: { joinedAt: "asc" },
            },
            _count: {
                select: {
                    applications: true,
                    resumes: { where: { deletedAt: null } },
                    savedJobs: true,
                    savedSearches: { where: { deletedAt: null } },
                    createdJobs: true,
                },
            },
        },
    });

    if (!user) {
        throw new AppError(404, "User not found.");
    }

    const { _count, ...userDetails } = user;

    return {
        ...userDetails,
        status: getUserStatus(user),
        counts: _count,
    };
}

export async function updatePlatformUserSuspension(
    actorUserId: string,
    targetUserId: string,
    input: AdminUserSuspensionInput,
) {
    if (actorUserId === targetUserId) {
        throw new AppError(400, "You cannot suspend or restore your own administrator account.");
    }

    return prisma.$transaction(async (transaction) => {
        const target = await transaction.user.findUnique({
            where: { id: targetUserId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                isAdmin: true,
                suspendedAt: true,
                suspensionReason: true,
                deletedAt: true,
            },
        });

        if (!target || target.deletedAt) {
            throw new AppError(404, "Active user account not found.");
        }

        if (target.isAdmin) {
            throw new AppError(403, "Platform administrator accounts cannot be moderated from this endpoint.");
        }

        const now = new Date();

        if (input.suspended) {
            if (target.suspendedAt) {
                throw new AppError(409, "This user account is already suspended.");
            }

            const updatedUser = await transaction.user.update({
                where: { id: target.id },
                data: {
                    suspendedAt: now,
                    suspensionReason: input.reason ?? null,
                    suspendedById: actorUserId,
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    isAdmin: true,
                    suspendedAt: true,
                    suspensionReason: true,
                    suspendedById: true,
                    createdAt: true,
                    updatedAt: true,
                    deletedAt: true,
                },
            });

            const revokedSessions = await transaction.refreshToken.updateMany({
                where: { userId: target.id, revokedAt: null },
                data: { revokedAt: now },
            });

            await createPlatformAuditLog({
                transaction,
                actorUserId,
                action: PLATFORM_ADMIN_ACTIONS.USER_SUSPENDED,
                entityType: PLATFORM_ADMIN_ENTITY_TYPES.USER,
                entityId: target.id,
                metadata: {
                    targetEmail: target.email,
                    targetDisplayName: `${target.firstName} ${target.lastName}`.trim(),
                    reason: input.reason ?? null,
                    revokedSessions: revokedSessions.count,
                },
            });

            return {
                user: { ...updatedUser, status: "SUSPENDED" as const },
                revokedSessions: revokedSessions.count,
            };
        }

        if (!target.suspendedAt) {
            throw new AppError(409, "This user account is not suspended.");
        }

        const previousReason = target.suspensionReason;

        const updatedUser = await transaction.user.update({
            where: { id: target.id },
            data: {
                suspendedAt: null,
                suspensionReason: null,
                suspendedById: null,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                isAdmin: true,
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
            action: PLATFORM_ADMIN_ACTIONS.USER_RESTORED,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.USER,
            entityId: target.id,
            metadata: {
                targetEmail: target.email,
                targetDisplayName: `${target.firstName} ${target.lastName}`.trim(),
                previousSuspensionReason: previousReason,
            },
        });

        return {
            user: { ...updatedUser, status: "ACTIVE" as const },
            revokedSessions: 0,
        };
    });
}
