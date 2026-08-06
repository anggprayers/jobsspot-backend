import type { Prisma } from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import type {
    PlatformAdminAction,
    PlatformAdminEntityType,
} from "./platform-admin.constants.js";

type CreatePlatformAuditLogParameters = {
    transaction: Prisma.TransactionClient;
    actorUserId: string;
    action: PlatformAdminAction;
    entityType: PlatformAdminEntityType;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
};

export async function createPlatformAuditLog({
    transaction,
    actorUserId,
    action,
    entityType,
    entityId,
    metadata,
}: CreatePlatformAuditLogParameters) {
    const actor = await transaction.user.findFirst({
        where: {
            id: actorUserId,
            deletedAt: null,
            suspendedAt: null,
            isAdmin: true,
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
        },
    });

    if (!actor) {
        throw new AppError(403, "The platform administrator account is unavailable.");
    }

    return transaction.platformAuditLog.create({
        data: {
            actorUserId: actor.id,
            actorDisplayName: `${actor.firstName} ${actor.lastName}`.trim(),
            actorEmail: actor.email,
            action,
            entityType,
            entityId: entityId ?? null,
            ...(metadata !== undefined && { metadata }),
        },
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
        },
    });
}

type GetPlatformActivityParameters = {
    page: number;
    limit: number;
    action?: string | undefined;
    entityType?: string | undefined;
};

export async function getPlatformActivity({
    page,
    limit,
    action,
    entityType,
}: GetPlatformActivityParameters) {
    const where: Prisma.PlatformAuditLogWhereInput = {
        ...(action && { action }),
        ...(entityType && { entityType }),
    };

    const skip = (page - 1) * limit;

    const [activity, totalItems] = await Promise.all([
        prisma.platformAuditLog.findMany({
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
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip,
            take: limit,
        }),
        prisma.platformAuditLog.count({ where }),
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
