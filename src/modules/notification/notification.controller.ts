import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import {
    getUserNotifications,
    getUserNotificationUnreadCount,
    markAllUserNotificationsRead,
    markUserNotificationRead,
} from "./notification.service.js";
import type {
    MarkAllNotificationsReadInput,
    NotificationListQuery,
    NotificationUnreadCountQuery,
} from "./notification.validation.js";

function getAuthenticatedUserId(request: Request): string {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    return request.user.id;
}

export async function getNotificationsController(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const query = response.locals.validatedQuery as NotificationListQuery;

    const result = await getUserNotifications({
        userId,
        ...query,
    });

    response.status(200).json({
        success: true,
        message: "Notifications retrieved successfully.",
        ...result,
    });
}

export async function getNotificationUnreadCountController(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const query = response.locals
        .validatedQuery as NotificationUnreadCountQuery;

    const result = await getUserNotificationUnreadCount({
        userId,
        ...query,
    });

    response.status(200).json({
        success: true,
        message: "Notification unread count retrieved successfully.",
        ...result,
    });
}

export async function markNotificationReadController(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const notificationId = request.params.notificationId as string;

    const notification = await markUserNotificationRead(
        userId,
        notificationId,
    );

    response.status(200).json({
        success: true,
        message: "Notification marked as read.",
        notification,
    });
}

export async function markAllNotificationsReadController(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const input = request.body as MarkAllNotificationsReadInput;

    const result = await markAllUserNotificationsRead(
        userId,
        input,
    );

    response.status(200).json({
        success: true,
        message: "Notifications marked as read.",
        ...result,
    });
}
