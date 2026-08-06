import {
    ApplicationStatus,
    CompanyMemberRole,
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
    "companyMembership" | "notification"
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

const employerNotificationRoles = [
    CompanyMemberRole.OWNER,
    CompanyMemberRole.ADMIN,
    CompanyMemberRole.RECRUITER,
];

async function getEmployerRecipientIds(
    client: ApplicationNotificationClient,
    companyId: string,
): Promise<string[]> {
    const memberships = await client.companyMembership.findMany({
        where: {
            companyId,
            deletedAt: null,
            role: {
                in: employerNotificationRoles,
            },
            user: {
                deletedAt: null,
                suspendedAt: null,
            },
        },
        select: {
            userId: true,
        },
    });

    return memberships.map((membership) => membership.userId);
}

function getStatusNotificationCopy(status: ApplicationStatus): {
    title: string;
    messageVerb: string;
} {
    switch (status) {
        case ApplicationStatus.UNDER_REVIEW:
            return {
                title: "Application under review",
                messageVerb: "moved your application to under review",
            };

        case ApplicationStatus.SHORTLISTED:
            return {
                title: "You were shortlisted",
                messageVerb: "shortlisted your application",
            };

        case ApplicationStatus.INTERVIEW:
            return {
                title: "Application moved to interview",
                messageVerb: "moved your application to the interview stage",
            };

        case ApplicationStatus.OFFERED:
            return {
                title: "You received an offer update",
                messageVerb: "marked your application as offered",
            };

        case ApplicationStatus.HIRED:
            return {
                title: "Application marked as hired",
                messageVerb: "marked your application as hired",
            };

        case ApplicationStatus.REJECTED:
            return {
                title: "Application status updated",
                messageVerb: "updated your application to not selected",
            };

        default:
            return {
                title: "Application status updated",
                messageVerb: `updated your application to ${status
                    .toLowerCase()
                    .replaceAll("_", " ")}`,
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
    const employerRecipientIds = await getEmployerRecipientIds(
        client,
        companyId,
    );

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

        ...employerRecipientIds.map((userId) =>
            createNotification({
                client,
                userId,
                audience: NotificationAudience.EMPLOYER,
                type: NOTIFICATION_TYPES.NEW_APPLICATION,
                eventKey: `application:${applicationId}:new`,
                title: "New application received",
                message: `${applicantName} applied for ${jobTitle}.`,
                actionUrl: `/employers/applicants/${applicationId}`,
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

export async function createApplicationFirstViewedNotification({
    client,
    applicationId,
    applicantId,
    jobId,
    jobTitle,
    companyId,
    companyName,
}: Omit<ApplicationContext, "applicantName"> & {
    client: ApplicationNotificationClient;
}) {
    await createNotification({
        client,
        userId: applicantId,
        audience: NotificationAudience.JOB_SEEKER,
        type: NOTIFICATION_TYPES.APPLICATION_FIRST_VIEWED,
        eventKey: `application:${applicationId}:first-viewed`,
        title: "Your application was viewed",
        message: `${companyName} viewed your application for ${jobTitle}.`,
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
    });
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
    const copy = getStatusNotificationCopy(newStatus);

    await createNotification({
        client,
        userId: applicantId,
        audience: NotificationAudience.JOB_SEEKER,
        type: NOTIFICATION_TYPES.APPLICATION_STATUS_CHANGED,
        eventKey: `application-status:${eventId}`,
        title: copy.title,
        message: `${companyName} ${copy.messageVerb} for ${jobTitle}.`,
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
    const employerRecipientIds = await getEmployerRecipientIds(
        client,
        companyId,
    );

    await Promise.all(
        employerRecipientIds.map((userId) =>
            createNotification({
                client,
                userId,
                audience: NotificationAudience.EMPLOYER,
                type: NOTIFICATION_TYPES.APPLICATION_WITHDRAWN,
                eventKey: `application:${applicationId}:withdrawn`,
                title: "Application withdrawn",
                message: `${applicantName} withdrew their application for ${jobTitle}.`,
                actionUrl: `/employers/applicants/${applicationId}`,
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
