import {
    CompanyMemberRole,
    NotificationAudience,
} from "../../generated/prisma/client.js";

import { prisma } from "../../lib/prisma.js";

import {
    NOTIFICATION_ENTITY_TYPES,
    NOTIFICATION_TYPES,
} from "./notification.constants.js";
import { createNotification } from "./notification.service.js";

function formatCompanyRole(role: CompanyMemberRole): string {
    return role
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/^./, (character) => character.toUpperCase());
}

export async function createCompanyInvitationAcceptedNotification({
    invitationId,
    eventId,
    invitedByUserId,
    acceptedUserId,
    acceptedUserName,
    companyId,
    companyName,
    role,
    membershipOutcome,
}: {
    invitationId: string;
    eventId: string;
    invitedByUserId: string;
    acceptedUserId: string;
    acceptedUserName: string;
    companyId: string;
    companyName: string;
    role: CompanyMemberRole;
    membershipOutcome: "CREATED" | "RESTORED" | "ALREADY_ACTIVE";
}) {
    await createNotification({
        userId: invitedByUserId,
        audience: NotificationAudience.EMPLOYER,
        type: NOTIFICATION_TYPES.COMPANY_INVITATION_ACCEPTED,
        eventKey: `company-invitation-accepted:${eventId}`,
        title: "Team invitation accepted",
        message: `${acceptedUserName} joined ${companyName} as ${formatCompanyRole(role)}.`,
        actionUrl: "/employers/team",
        entityType: NOTIFICATION_ENTITY_TYPES.COMPANY_INVITATION,
        entityId: invitationId,
        metadata: {
            invitationId,
            acceptedUserId,
            acceptedUserName,
            companyId,
            companyName,
            role,
            membershipOutcome,
        },
    });
}

export async function createCompanyModerationNotifications({
    eventId,
    companyId,
    companyName,
    suspended,
    reason,
}: {
    eventId: string;
    companyId: string;
    companyName: string;
    suspended: boolean;
    reason?: string | null;
}) {
    const memberships = await prisma.companyMembership.findMany({
        where: {
            companyId,
            deletedAt: null,
            user: {
                deletedAt: null,
                suspendedAt: null,
            },
        },
        select: {
            userId: true,
        },
    });

    const title = suspended
        ? "Company workspace suspended"
        : "Company workspace restored";

    const message = suspended
        ? `${companyName} has been suspended by JobsSpot. Employer workspace access and public job visibility are temporarily unavailable.${
              reason ? ` Reason: ${reason}` : ""
          }`
        : `${companyName} has been restored. Employer workspace access and public job visibility are available again.`;

    for (const membership of memberships) {
        await createNotification({
            userId: membership.userId,
            audience: NotificationAudience.SYSTEM,
            type: suspended
                ? NOTIFICATION_TYPES.COMPANY_SUSPENDED
                : NOTIFICATION_TYPES.COMPANY_RESTORED,
            eventKey: `company-moderation:${eventId}`,
            title,
            message,
            actionUrl: suspended ? "/contact" : "/employers",
            entityType: NOTIFICATION_ENTITY_TYPES.COMPANY,
            entityId: companyId,
            metadata: {
                companyId,
                companyName,
                suspended,
                reason: reason ?? null,
            },
        });
    }
}

export async function createJobModerationNotifications({
    eventId,
    jobId,
    jobTitle,
    companyId,
    companyName,
    hidden,
    reason,
}: {
    eventId: string;
    jobId: string;
    jobTitle: string;
    companyId: string;
    companyName: string;
    hidden: boolean;
    reason?: string | null;
}) {
    const memberships = await prisma.companyMembership.findMany({
        where: {
            companyId,
            deletedAt: null,
            role: {
                in: [
                    CompanyMemberRole.OWNER,
                    CompanyMemberRole.ADMIN,
                    CompanyMemberRole.RECRUITER,
                ],
            },
            user: {
                deletedAt: null,
                suspendedAt: null,
            },
        },
        select: { userId: true },
    });

    const title = hidden
        ? "Job hidden by JobsSpot"
        : "Job visibility restored";
    const message = hidden
        ? `${jobTitle} at ${companyName} has been hidden from public job listings by JobsSpot.${
              reason ? ` Reason: ${reason}` : ""
          }`
        : `${jobTitle} at ${companyName} is no longer hidden by JobsSpot. Its normal job status and expiration rules still determine public visibility.`;

    for (const membership of memberships) {
        await createNotification({
            userId: membership.userId,
            audience: NotificationAudience.EMPLOYER,
            type: NOTIFICATION_TYPES.JOB_MODERATED,
            eventKey: `job-moderation:${eventId}`,
            title,
            message,
            actionUrl: `/employers/jobs/${jobId}`,
            entityType: NOTIFICATION_ENTITY_TYPES.JOB,
            entityId: jobId,
            metadata: {
                jobId,
                jobTitle,
                companyId,
                companyName,
                hidden,
                reason: reason ?? null,
            },
        });
    }
}
