import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";

import { requireInternalCronSecret } from "./internal-maintenance.auth.js";
import {
    processJobExpirationNotificationsController,
    processNotificationEmailsController,
    processScheduledNotificationsController,
} from "./internal-maintenance.controller.js";

const internalMaintenanceRouter = Router();

internalMaintenanceRouter.use(requireInternalCronSecret);

internalMaintenanceRouter.post(
    "/job-expiration-notifications",
    asyncHandler(processJobExpirationNotificationsController),
);

internalMaintenanceRouter.post(
    "/notification-emails",
    asyncHandler(processNotificationEmailsController),
);

internalMaintenanceRouter.post(
    "/scheduled-notifications",
    asyncHandler(processScheduledNotificationsController),
);

export default internalMaintenanceRouter;
