import { NotificationAudience } from "../../generated/prisma/client.js";

import { prisma } from "../../lib/prisma.js";

import {
    NOTIFICATION_ENTITY_TYPES,
    NOTIFICATION_TYPES,
} from "./notification.constants.js";
import { createNotification } from "./notification.service.js";

export async function createAdminJobSubmissionNotifications({
    submissionId,
    referenceCode,
    jobTitle,
    companyName,
    contactEmail,
}: {
    submissionId: string;
    referenceCode: string;
    jobTitle: string;
    companyName: string;
    contactEmail: string;
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
            type: NOTIFICATION_TYPES.JOB_SUBMISSION_RECEIVED,
            eventKey: `job-submission-received:${submissionId}`,
            title: "New job submission received",
            message: `${companyName} submitted ${jobTitle} for review.`,
            actionUrl: `/admin/job-submissions/${submissionId}`,
            entityType: NOTIFICATION_ENTITY_TYPES.JOB_SUBMISSION,
            entityId: submissionId,
            metadata: {
                submissionId,
                referenceCode,
                jobTitle,
                companyName,
                contactEmail,
            },
        });
    }
}
