import { NotificationAudience } from "../../generated/prisma/client.js";

import { prisma } from "../../lib/prisma.js";

import {
    NOTIFICATION_ENTITY_TYPES,
    NOTIFICATION_TYPES,
} from "./notification.constants.js";
import { createNotification } from "./notification.service.js";

export async function createAdminJobReportNotifications({
    reportId,
    jobId,
    jobTitle,
    companyName,
    reasonLabel,
}: {
    reportId: string;
    jobId: string;
    jobTitle: string;
    companyName: string;
    reasonLabel: string;
}) {
    const admins = await prisma.user.findMany({
        where: {
            isAdmin: true,
            deletedAt: null,
            suspendedAt: null,
        },
        select: { id: true },
    });

    for (const admin of admins) {
        await createNotification({
            userId: admin.id,
            audience: NotificationAudience.ADMIN,
            type: NOTIFICATION_TYPES.ADMIN_REVIEW_REQUIRED,
            eventKey: `job-report-submitted:${reportId}`,
            title: "Job report needs review",
            message: `${jobTitle} at ${companyName} was reported for ${reasonLabel.toLowerCase()}.`,
            actionUrl: `/admin/reports/${reportId}`,
            entityType: NOTIFICATION_ENTITY_TYPES.JOB_REPORT,
            entityId: reportId,
            metadata: {
                reportId,
                jobId,
                jobTitle,
                companyName,
                reasonLabel,
            },
        });
    }
}

export async function createReporterJobReportUpdateNotification({
    reportId,
    reporterUserId,
    jobId,
    jobTitle,
    status,
}: {
    reportId: string;
    reporterUserId: string;
    jobId: string;
    jobTitle: string;
    status: "RESOLVED" | "DISMISSED";
}) {
    const resolved = status === "RESOLVED";

    await createNotification({
        userId: reporterUserId,
        audience: NotificationAudience.JOB_SEEKER,
        type: NOTIFICATION_TYPES.JOB_REPORT_UPDATED,
        eventKey: `job-report-updated:${reportId}:${status}`,
        title: resolved ? "Job report reviewed" : "Job report closed",
        message: resolved
            ? `Thanks for reporting ${jobTitle}. JobsSpot reviewed the report and completed moderation review.`
            : `Thanks for reporting ${jobTitle}. JobsSpot reviewed the report and closed it without additional moderation action.`,
        actionUrl: "/notifications",
        entityType: NOTIFICATION_ENTITY_TYPES.JOB_REPORT,
        entityId: reportId,
        metadata: {
            reportId,
            jobId,
            jobTitle,
            status,
        },
    });
}
