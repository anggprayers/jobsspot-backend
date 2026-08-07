import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireVerifiedEmail } from "../../middleware/requireVerifiedEmail.js";
import { validate } from "../../middleware/validate.js";
import { validateParams } from "../../middleware/validateParams.js";
import { validateQuery } from "../../middleware/validateQuery.js";

import {
    clearReadNotificationsController,
    getNotificationsController,
    getNotificationPreferencesController,
    getNotificationUnreadCountController,
    markAllNotificationsReadController,
    markNotificationReadController,
    updateNotificationPreferencesController,
} from "./notification.controller.js";
import {
    clearReadNotificationsSchema,
    markAllNotificationsReadSchema,
    notificationListQuerySchema,
    notificationUnreadCountQuerySchema,
    notificationUuidParamsSchema,
    updateNotificationPreferencesSchema,
} from "./notification.validation.js";

const notificationRouter = Router();

notificationRouter.use(
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
);

// GET /api/notifications/preferences
notificationRouter.get(
    "/preferences",
    asyncHandler(getNotificationPreferencesController),
);

// PATCH /api/notifications/preferences
notificationRouter.patch(
    "/preferences",
    validate(updateNotificationPreferencesSchema),
    asyncHandler(updateNotificationPreferencesController),
);

// GET /api/notifications
notificationRouter.get(
    "/",
    validateQuery(notificationListQuerySchema),
    asyncHandler(getNotificationsController),
);

// GET /api/notifications/unread-count
notificationRouter.get(
    "/unread-count",
    validateQuery(notificationUnreadCountQuerySchema),
    asyncHandler(getNotificationUnreadCountController),
);

// PATCH /api/notifications/read-all
notificationRouter.patch(
    "/read-all",
    validate(markAllNotificationsReadSchema),
    asyncHandler(markAllNotificationsReadController),
);

// PATCH /api/notifications/clear-read
notificationRouter.patch(
    "/clear-read",
    validate(clearReadNotificationsSchema),
    asyncHandler(clearReadNotificationsController),
);

// PATCH /api/notifications/:notificationId/read
notificationRouter.patch(
    "/:notificationId/read",
    validateParams(notificationUuidParamsSchema),
    asyncHandler(markNotificationReadController),
);

export default notificationRouter;
