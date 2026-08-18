import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";

import { requireInternalCronSecret } from "./internal-maintenance.auth.js";
import {
    processJobExpirationNotificationsController,
    processNotificationEmailsController,
    processSavedSearchAlertsController,
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
    "/saved-search-alerts",
    asyncHandler(processSavedSearchAlertsController),
);

internalMaintenanceRouter.post(
    "/scheduled-notifications",
    asyncHandler(processScheduledNotificationsController),
);

export default internalMaintenanceRouter;
