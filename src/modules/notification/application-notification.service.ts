import {
    ApplicationStatus,
    NotificationAudience,
    Prisma,
} from "../../generated/prisma/client.js";

import { createNotification } from "./notification.service.js";
import {
    NOTIFICATION_ENTITY_TYPES,
    NOTIFICATION_TYPES,
} from "./notification.constants.js";

type ApplicationNotificationClient = Pick<
    Prisma.TransactionClient,
    "notification" | "user"
>;

type ApplicationContext = {
    applicationId: string;
    applicantId: string;
    applicantName: string;
    jobId: string;
    jobTitle: string;
    companyId: string;
    companyName: string;
};

type ApplicationStatusNotificationParameters = ApplicationContext & {
    client: ApplicationNotificationClient;
    previousStatus: ApplicationStatus;
    newStatus: ApplicationStatus;
    eventId: string;
};

async function getPlatformAdminRecipientIds(
    client: ApplicationNotificationClient,
): Promise<string[]> {
    const admins = await client.user.findMany({
        where: {
            isAdmin: true,
            deletedAt: null,
            suspendedAt: null,
        },
        select: { id: true },
    });

    return admins.map((admin) => admin.id);
}

function getStatusNotificationCopy(
    status: ApplicationStatus,
    jobTitle: string,
    companyName: string,
): {
    title: string;
    message: string;
} {
    switch (status) {
        case ApplicationStatus.UNDER_REVIEW:
        case ApplicationStatus.SHORTLISTED:
            return {
                title: "Application under review",
                message: `Your application for ${jobTitle} at ${companyName} is under review.`,
            };

        case ApplicationStatus.INTERVIEW:
            return {
                title: "Interview stage",
                message: `Your application for ${jobTitle} at ${companyName} moved to the interview stage.`,
            };

        case ApplicationStatus.OFFERED:
            return {
                title: "Offer update",
                message: `Your application for ${jobTitle} at ${companyName} has an offer update.`,
            };

        case ApplicationStatus.HIRED:
            return {
                title: "Application marked as hired",
                message: `Your application for ${jobTitle} at ${companyName} was marked as hired.`,
            };

        case ApplicationStatus.REJECTED:
            return {
                title: "Application update",
                message: `Your application for ${jobTitle} at ${companyName} was not selected.`,
            };

        default:
            return {
                title: "Application status updated",
                message: `Your application for ${jobTitle} at ${companyName} was updated.`,
            };
    }
}

export async function createApplicationSubmittedNotifications({
    client,
    applicationId,
    applicantId,
    applicantName,
    jobId,
    jobTitle,
    companyId,
    companyName,
}: ApplicationContext & {
    client: ApplicationNotificationClient;
}) {
    const platformAdminRecipientIds = await getPlatformAdminRecipientIds(client);

    await Promise.all([
        createNotification({
            client,
            userId: applicantId,
            audience: NotificationAudience.JOB_SEEKER,
            type: NOTIFICATION_TYPES.APPLICATION_SUBMITTED,
            eventKey: `application:${applicationId}:submitted`,
            title: "Application submitted",
            message: `Your application for ${jobTitle} at ${companyName} was submitted successfully.`,
            actionUrl: "/account/applications",
            entityType: NOTIFICATION_ENTITY_TYPES.APPLICATION,
            entityId: applicationId,
            metadata: {
                applicationId,
                jobId,
                jobTitle,
                companyId,
                companyName,
            },
        }),

        ...platformAdminRecipientIds.map((userId) =>
            createNotification({
                client,
                userId,
                audience: NotificationAudience.ADMIN,
                type: NOTIFICATION_TYPES.NEW_APPLICATION,
                eventKey: `application:${applicationId}:new`,
                title: "New application received",
                message: `${applicantName} applied for ${jobTitle} at ${companyName}.`,
                actionUrl: `/admin/applications/${applicationId}`,
                entityType: NOTIFICATION_ENTITY_TYPES.APPLICATION,
                entityId: applicationId,
                metadata: {
                    applicationId,
                    applicantId,
                    applicantName,
                    jobId,
                    jobTitle,
                    companyId,
                    companyName,
                },
            }),
        ),
    ]);
}

export async function createApplicationStatusChangedNotification({
    client,
    applicationId,
    applicantId,
    jobId,
    jobTitle,
    companyId,
    companyName,
    previousStatus,
    newStatus,
    eventId,
}: ApplicationStatusNotificationParameters) {
    const copy = getStatusNotificationCopy(newStatus, jobTitle, companyName);

    await createNotification({
        client,
        userId: applicantId,
        audience: NotificationAudience.JOB_SEEKER,
        type: NOTIFICATION_TYPES.APPLICATION_STATUS_CHANGED,
        eventKey: `application-status:${eventId}`,
        title: copy.title,
        message: copy.message,
        actionUrl: "/account/applications",
        entityType: NOTIFICATION_ENTITY_TYPES.APPLICATION,
        entityId: applicationId,
        metadata: {
            applicationId,
            jobId,
            jobTitle,
            companyId,
            companyName,
            previousStatus,
            newStatus,
        },
    });
}

export async function createApplicationWithdrawnNotifications({
    client,
    applicationId,
    applicantId,
    applicantName,
    jobId,
    jobTitle,
    companyId,
    companyName,
}: ApplicationContext & {
    client: ApplicationNotificationClient;
}) {
    const platformAdminRecipientIds = await getPlatformAdminRecipientIds(client);

    await Promise.all(
        platformAdminRecipientIds.map((userId) =>
            createNotification({
                client,
                userId,
                audience: NotificationAudience.ADMIN,
                type: NOTIFICATION_TYPES.APPLICATION_WITHDRAWN,
                eventKey: `application:${applicationId}:withdrawn`,
                title: "Application withdrawn",
                message: `${applicantName} withdrew their application for ${jobTitle} at ${companyName}.`,
                actionUrl: `/admin/applications/${applicationId}`,
                entityType: NOTIFICATION_ENTITY_TYPES.APPLICATION,
                entityId: applicationId,
                metadata: {
                    applicationId,
                    applicantId,
                    applicantName,
                    jobId,
                    jobTitle,
                    companyId,
                    companyName,
                },
            }),
        ),
    );
}
