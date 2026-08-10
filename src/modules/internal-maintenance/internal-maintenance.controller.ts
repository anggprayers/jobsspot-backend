import type { Request, Response } from "express";

import { processJobExpirationNotifications } from "../notification/job-expiration-notification.service.js";
import { processPendingNotificationEmails } from "../notification/notification-email.service.js";
import { processDueSavedSearchAlerts } from "../saved-search/saved-search-alert.service.js";

export async function processJobExpirationNotificationsController(
    _request: Request,
    response: Response,
): Promise<void> {
    const result = await processJobExpirationNotifications();

    response.status(200).json({
        success: true,
        message: "Job expiration notifications processed successfully.",
        result,
    });
}

export async function processNotificationEmailsController(
    _request: Request,
    response: Response,
): Promise<void> {
    const result = await processPendingNotificationEmails();

    response.status(200).json({
        success: true,
        message: "Notification emails processed successfully.",
        result,
    });
}


export async function processSavedSearchAlertsController(
    _request: Request,
    response: Response,
): Promise<void> {
    const result = await processDueSavedSearchAlerts();

    response.status(200).json({
        success: true,
        message: "Saved search alerts processed successfully.",
        result,
    });
}

export async function processScheduledNotificationsController(
    _request: Request,
    response: Response,
): Promise<void> {
    const jobExpiration = await processJobExpirationNotifications();
    const savedSearchAlerts = await processDueSavedSearchAlerts();
    const emailDelivery = await processPendingNotificationEmails();

    response.status(200).json({
        success: true,
        message: "Scheduled notification maintenance completed successfully.",
        result: {
            jobExpiration,
            savedSearchAlerts,
            emailDelivery,
        },
    });
}
