import {
    CompanyMemberRole,
    JobStatus,
    NotificationAudience,
} from "../../generated/prisma/client.js";

import { prisma } from "../../lib/prisma.js";

import {
    NOTIFICATION_ENTITY_TYPES,
    NOTIFICATION_TYPES,
} from "./notification.constants.js";
import { createNotification } from "./notification.service.js";

const EXPIRING_SOON_WINDOW_DAYS = 3;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const notificationRecipientRoles = [
    CompanyMemberRole.OWNER,
    CompanyMemberRole.ADMIN,
    CompanyMemberRole.RECRUITER,
];

function formatTimeUntilExpiration(expiresAt: Date, now: Date): string {
    const remainingMilliseconds = Math.max(0, expiresAt.getTime() - now.getTime());
    const remainingHours = Math.ceil(remainingMilliseconds / (60 * 60 * 1000));

    if (remainingHours <= 24) {
        return remainingHours <= 1 ? "less than an hour" : `${remainingHours} hours`;
    }

    const remainingDays = Math.ceil(remainingMilliseconds / MILLISECONDS_PER_DAY);
    return remainingDays === 1 ? "1 day" : `${remainingDays} days`;
}

export async function processJobExpirationNotifications(now = new Date()) {
    const expiringWindowEnd = new Date(
        now.getTime() + EXPIRING_SOON_WINDOW_DAYS * MILLISECONDS_PER_DAY,
    );

    const jobs = await prisma.job.findMany({
        where: {
            deletedAt: null,
            status: JobStatus.PUBLISHED,
            expiresAt: {
                not: null,
                lte: expiringWindowEnd,
            },
            company: {
                deletedAt: null,
                suspendedAt: null,
            },
        },
        select: {
            id: true,
            title: true,
            expiresAt: true,
            company: {
                select: {
                    id: true,
                    name: true,
                    memberships: {
                        where: {
                            deletedAt: null,
                            role: {
                                in: notificationRecipientRoles,
                            },
                            user: {
                                deletedAt: null,
                                suspendedAt: null,
                            },
                        },
                        select: {
                            userId: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            expiresAt: "asc",
        },
    });

    let expiringJobs = 0;
    let expiredJobs = 0;
    let recipientNotificationsProcessed = 0;

    for (const job of jobs) {
        if (!job.expiresAt) {
            continue;
        }

        const isExpired = job.expiresAt <= now;
        const expirationCycleKey = job.expiresAt.toISOString();

        if (isExpired) {
            expiredJobs += 1;
        } else {
            expiringJobs += 1;
        }

        const type = isExpired
            ? NOTIFICATION_TYPES.JOB_EXPIRED
            : NOTIFICATION_TYPES.JOB_EXPIRING;
        const title = isExpired ? "Job posting expired" : "Job posting expires soon";
        const message = isExpired
            ? `${job.title} at ${job.company.name} has expired and is no longer visible to job seekers.`
            : `${job.title} at ${job.company.name} expires in ${formatTimeUntilExpiration(job.expiresAt, now)}.`;
        const eventKey = `${isExpired ? "job-expired" : "job-expiring"}:${job.id}:${expirationCycleKey}`;

        for (const membership of job.company.memberships) {
            await createNotification({
                userId: membership.userId,
                audience: NotificationAudience.EMPLOYER,
                type,
                eventKey,
                title,
                message,
                actionUrl: `/employers/jobs/${job.id}`,
                entityType: NOTIFICATION_ENTITY_TYPES.JOB,
                entityId: job.id,
                metadata: {
                    jobId: job.id,
                    jobTitle: job.title,
                    companyId: job.company.id,
                    companyName: job.company.name,
                    expiresAt: job.expiresAt.toISOString(),
                    expired: isExpired,
                },
            });

            recipientNotificationsProcessed += 1;
        }
    }

    return {
        jobsScanned: jobs.length,
        expiringJobs,
        expiredJobs,
        recipientNotificationsProcessed,
        expiringSoonWindowDays: EXPIRING_SOON_WINDOW_DAYS,
        processedAt: now,
    };
}
