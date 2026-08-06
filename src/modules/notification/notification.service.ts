import {
    NotificationAudience,
    Prisma,
} from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import type {
    MarkAllNotificationsReadInput,
    NotificationListQuery,
    NotificationUnreadCountQuery,
} from "./notification.validation.js";

type NotificationClient = Pick<
    Prisma.TransactionClient,
    "notification"
>;

type CreateNotificationParameters = {
    client?: NotificationClient;
    userId: string;
    audience: NotificationAudience;
    type: string;
    eventKey: string;
    title: string;
    message: string;
    actionUrl?: string;
    entityType?: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
    emailedAt?: Date;
};

const notificationSelect = {
    id: true,
    audience: true,
    type: true,
    title: true,
    message: true,
    actionUrl: true,
    entityType: true,
    entityId: true,
    metadata: true,
    readAt: true,
    emailedAt: true,
    createdAt: true,
} satisfies Prisma.NotificationSelect;

function getAudienceFilter(
    audience?: NotificationAudience,
): Prisma.EnumNotificationAudienceFilter | NotificationAudience | undefined {
    if (!audience) {
        return undefined;
    }

    if (audience === NotificationAudience.SYSTEM) {
        return NotificationAudience.SYSTEM;
    }

    return {
        in: [audience, NotificationAudience.SYSTEM],
    };
}

function buildUserNotificationWhere(
    userId: string,
    audience?: NotificationAudience,
): Prisma.NotificationWhereInput {
    const audienceFilter = getAudienceFilter(audience);

    return {
        userId,

        ...(audienceFilter && {
            audience: audienceFilter,
        }),
    };
}

export async function runNotificationTaskSafely(
    taskName: string,
    task: () => Promise<unknown>,
): Promise<void> {
    try {
        await task();
    } catch (error) {
        console.error(`Notification task failed: ${taskName}`, error);
    }
}

export async function createNotification({
    client = prisma,
    userId,
    audience,
    type,
    eventKey,
    title,
    message,
    actionUrl,
    entityType,
    entityId,
    metadata,
    emailedAt,
}: CreateNotificationParameters) {
    return client.notification.upsert({
        where: {
            userId_eventKey: {
                userId,
                eventKey,
            },
        },
        update: {},
        create: {
            userId,
            audience,
            type,
            eventKey,
            title,
            message,

            ...(actionUrl && {
                actionUrl,
            }),

            ...(entityType && {
                entityType,
            }),

            ...(entityId && {
                entityId,
            }),

            ...(metadata !== undefined && {
                metadata,
            }),

            ...(emailedAt && {
                emailedAt,
            }),
        },
        select: notificationSelect,
    });
}

export async function getUserNotifications({
    userId,
    page,
    limit,
    status,
    audience,
}: NotificationListQuery & {
    userId: string;
}) {
    const baseWhere = buildUserNotificationWhere(
        userId,
        audience,
    );

    const where: Prisma.NotificationWhereInput = {
        ...baseWhere,

        ...(status === "UNREAD" && {
            readAt: null,
        }),

        ...(status === "READ" && {
            readAt: {
                not: null,
            },
        }),
    };

    const skip = (page - 1) * limit;

    const [notifications, totalItems, unreadCount] =
        await Promise.all([
            prisma.notification.findMany({
                where,
                select: notificationSelect,
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

            prisma.notification.count({
                where,
            }),

            prisma.notification.count({
                where: {
                    ...baseWhere,
                    readAt: null,
                },
            }),
        ]);

    const totalPages = Math.max(
        1,
        Math.ceil(totalItems / limit),
    );

    return {
        notifications,
        unreadCount,
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

export async function getUserNotificationUnreadCount({
    userId,
    audience,
}: NotificationUnreadCountQuery & {
    userId: string;
}) {
    const unreadCount = await prisma.notification.count({
        where: {
            ...buildUserNotificationWhere(
                userId,
                audience,
            ),
            readAt: null,
        },
    });

    return {
        unreadCount,
    };
}

export async function markUserNotificationRead(
    userId: string,
    notificationId: string,
) {
    const notification = await prisma.notification.findFirst({
        where: {
            id: notificationId,
            userId,
        },
        select: notificationSelect,
    });

    if (!notification) {
        throw new AppError(404, "Notification not found.");
    }

    if (notification.readAt) {
        return notification;
    }

    return prisma.notification.update({
        where: {
            id: notification.id,
        },
        data: {
            readAt: new Date(),
        },
        select: notificationSelect,
    });
}

export async function markAllUserNotificationsRead(
    userId: string,
    input: MarkAllNotificationsReadInput,
) {
    const result = await prisma.notification.updateMany({
        where: {
            ...buildUserNotificationWhere(
                userId,
                input.audience,
            ),
            readAt: null,
        },
        data: {
            readAt: new Date(),
        },
    });

    return {
        markedReadCount: result.count,
    };
}
