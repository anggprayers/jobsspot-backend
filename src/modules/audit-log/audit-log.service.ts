import type { Prisma } from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import type { AuditActionValue, AuditEntityTypeValue } from "./audit-log.constants.js";

type CreateCompanyAuditLogParameters = {
    transaction: Prisma.TransactionClient;
    companyId: string;
    actorUserId: string;
    action: AuditActionValue;
    entityType: AuditEntityTypeValue;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
};

export async function createCompanyAuditLog({
    transaction,
    companyId,
    actorUserId,
    action,
    entityType,
    entityId,
    metadata,
}: CreateCompanyAuditLogParameters) {
    const actor = await transaction.user.findFirst({
        where: {
            id: actorUserId,
            deletedAt: null,
        },

        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
        },
    });

    if (!actor) {
        throw new AppError(404, "Audit actor not found.");
    }

    const actorDisplayName = `${actor.firstName} ${actor.lastName}`.trim();

    return transaction.auditLog.create({
        data: {
            companyId,
            actorUserId: actor.id,
            actorDisplayName,
            actorEmail: actor.email,
            action,
            entityType,
            entityId: entityId ?? null,

            ...(metadata !== undefined && {
                metadata,
            }),
        },

        select: {
            id: true,
            companyId: true,
            actorUserId: true,
            actorDisplayName: true,
            actorEmail: true,
            action: true,
            entityType: true,
            entityId: true,
            metadata: true,
            createdAt: true,
        },
    });
}

type GetCompanyActivityParameters = {
    companyId: string;
    page: number;
    limit: number;
    action?: string;
    entityType?: AuditEntityTypeValue;
};

export async function getCompanyActivity({ companyId, page, limit, action, entityType }: GetCompanyActivityParameters) {
    const company = await prisma.company.findFirst({
        where: {
            id: companyId,
            deletedAt: null,
        },

        select: {
            id: true,
        },
    });

    if (!company) {
        throw new AppError(404, "Company not found.");
    }

    const where: Prisma.AuditLogWhereInput = {
        companyId,

        ...(action && {
            action,
        }),

        ...(entityType && {
            entityType,
        }),
    };

    const skip = (page - 1) * limit;

    const [activity, totalItems] = await Promise.all([
        prisma.auditLog.findMany({
            where,

            select: {
                id: true,
                actorUserId: true,
                actorDisplayName: true,
                actorEmail: true,
                action: true,
                entityType: true,
                entityId: true,
                metadata: true,
                createdAt: true,

                actorUser: {
                    select: {
                        avatarUrl: true,
                    },
                },
            },

            orderBy: [
                {
                    createdAt: "desc",
                },
                {
                    id: "desc",
                },
            ],

            skip,
            take: limit,
        }),

        prisma.auditLog.count({
            where,
        }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return {
        activity,

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
