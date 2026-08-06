import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireVerifiedEmail } from "../../middleware/requireVerifiedEmail.js";
import { validate } from "../../middleware/validate.js";
import { validateParams } from "../../middleware/validateParams.js";
import { validateQuery } from "../../middleware/validateQuery.js";

import {
    getNotificationsController,
    getNotificationUnreadCountController,
    markAllNotificationsReadController,
    markNotificationReadController,
} from "./notification.controller.js";
import {
    markAllNotificationsReadSchema,
    notificationListQuerySchema,
    notificationUnreadCountQuerySchema,
    notificationUuidParamsSchema,
} from "./notification.validation.js";

const notificationRouter = Router();

notificationRouter.use(
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
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

// PATCH /api/notifications/:notificationId/read
notificationRouter.patch(
    "/:notificationId/read",
    validateParams(notificationUuidParamsSchema),
    asyncHandler(markNotificationReadController),
);

export default notificationRouter;
