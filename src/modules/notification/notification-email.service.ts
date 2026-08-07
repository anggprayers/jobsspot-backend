import { NotificationAudience } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { emailConfig } from "../email/email.config.js";
import { sendTransactionalEmail } from "../email/email.service.js";
import { createNotificationEmailTemplate } from "../email/templates/notification.template.js";

import { NOTIFICATION_TYPES } from "./notification.constants.js";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "./notification-preference.service.js";

export type NotificationEmailPreferenceKey =
    | "jobSeekerApplicationUpdatesEmail"
    | "jobSeekerApplicationViewedEmail"
    | "employerApplicationEmail"
    | "employerTeamEmail"
    | "employerJobEmail"
    | "systemEmail";

const PROCESS_BATCH_SIZE = 100;

function getPreferenceKey(type: string): NotificationEmailPreferenceKey | null {
    switch (type) {
        case NOTIFICATION_TYPES.APPLICATION_SUBMITTED:
        case NOTIFICATION_TYPES.APPLICATION_STATUS_CHANGED:
            return "jobSeekerApplicationUpdatesEmail";

        case NOTIFICATION_TYPES.APPLICATION_FIRST_VIEWED:
            return "jobSeekerApplicationViewedEmail";

        case NOTIFICATION_TYPES.NEW_APPLICATION:
        case NOTIFICATION_TYPES.APPLICATION_WITHDRAWN:
            return "employerApplicationEmail";

        case NOTIFICATION_TYPES.COMPANY_INVITATION_ACCEPTED:
            return "employerTeamEmail";

        case NOTIFICATION_TYPES.JOB_EXPIRING:
        case NOTIFICATION_TYPES.JOB_EXPIRED:
        case NOTIFICATION_TYPES.JOB_MODERATED:
            return "employerJobEmail";

        case NOTIFICATION_TYPES.ADMIN_REVIEW_REQUIRED:
        case NOTIFICATION_TYPES.JOB_REPORT_UPDATED:
        case NOTIFICATION_TYPES.COMPANY_SUSPENDED:
        case NOTIFICATION_TYPES.COMPANY_RESTORED:
            return "systemEmail";

        default:
            return null;
    }
}

function makeAbsoluteActionUrl(actionUrl: string | null): string | null {
    if (!actionUrl) {
        return null;
    }

    if (/^https?:\/\//i.test(actionUrl)) {
        return actionUrl;
    }

    return `${emailConfig.frontendUrl}${actionUrl.startsWith("/") ? actionUrl : `/${actionUrl}`}`;
}

export async function processPendingNotificationEmails(now = new Date()) {
    const notifications = await prisma.notification.findMany({
        where: {
            emailProcessedAt: null,
            clearedAt: null,
        },
        select: {
            id: true,
            userId: true,
            audience: true,
            type: true,
            title: true,
            message: true,
            actionUrl: true,
            emailedAt: true,
            user: {
                select: {
                    email: true,
                    firstName: true,
                    isEmailVerified: true,
                    deletedAt: true,
                    notificationPreference: {
                        select: {
                            jobSeekerApplicationUpdatesEmail: true,
                            jobSeekerApplicationViewedEmail: true,
                            employerApplicationEmail: true,
                            employerTeamEmail: true,
                            employerJobEmail: true,
                            systemEmail: true,
                        },
                    },
                },
            },
        },
        orderBy: [
            { createdAt: "asc" },
            { id: "asc" },
        ],
        take: PROCESS_BATCH_SIZE,
    });

    let emailed = 0;
    let skipped = 0;
    let failed = 0;

    for (const notification of notifications) {
        const preferenceKey = getPreferenceKey(notification.type);
        const preferences =
            notification.user.notificationPreference ??
            DEFAULT_NOTIFICATION_PREFERENCES;

        const shouldSkip =
            !preferenceKey ||
            notification.user.deletedAt !== null ||
            !notification.user.isEmailVerified ||
            !preferences[preferenceKey];

        if (shouldSkip) {
            await prisma.notification.update({
                where: { id: notification.id },
                data: { emailProcessedAt: now },
            });
            skipped += 1;
            continue;
        }

        if (notification.emailedAt) {
            await prisma.notification.update({
                where: { id: notification.id },
                data: { emailProcessedAt: now },
            });
            skipped += 1;
            continue;
        }

        try {
            const actionUrl = makeAbsoluteActionUrl(notification.actionUrl);
            const email = createNotificationEmailTemplate({
                recipientName: notification.user.firstName,
                title: notification.title,
                message: notification.message,
                actionUrl,
            });

            await sendTransactionalEmail({
                to: notification.user.email,
                subject: email.subject,
                html: email.html,
                text: email.text,
                idempotencyKey: `notification-email:${notification.id}`,
            });

            await prisma.notification.update({
                where: { id: notification.id },
                data: {
                    emailedAt: now,
                    emailProcessedAt: now,
                },
            });
            emailed += 1;
        } catch (error) {
            failed += 1;
            console.error("Notification email delivery failed.", {
                notificationId: notification.id,
                userId: notification.userId,
                audience: notification.audience as NotificationAudience,
                type: notification.type,
                error,
            });
        }
    }

    return {
        scanned: notifications.length,
        emailed,
        skipped,
        failed,
        batchSize: PROCESS_BATCH_SIZE,
        processedAt: now,
    };
}
