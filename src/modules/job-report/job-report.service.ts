import { JobReportReason, JobStatus, Prisma } from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import { createAdminJobReportNotifications } from "../notification/job-report-notification.service.js";
import { runNotificationTaskSafely } from "../notification/notification.service.js";

import type { CreateJobReportInput } from "./job-report.validation.js";

const REASON_LABELS: Record<JobReportReason, string> = {
    [JobReportReason.SCAM_FRAUD]: "possible scam or fraud",
    [JobReportReason.MISLEADING]: "misleading or incorrect information",
    [JobReportReason.DISCRIMINATION]: "discriminatory content",
    [JobReportReason.SPAM_DUPLICATE]: "spam or duplicate content",
    [JobReportReason.INAPPROPRIATE]: "inappropriate content",
    [JobReportReason.OTHER]: "another concern",
};

function isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createJobReport({
    reporterUserId,
    data,
}: {
    reporterUserId: string;
    data: CreateJobReportInput;
}) {
    const now = new Date();

    const job = await prisma.job.findFirst({
        where: {
            id: data.jobId,
            status: JobStatus.PUBLISHED,
            deletedAt: null,
            adminHiddenAt: null,
            company: {
                deletedAt: null,
                suspendedAt: null,
            },
            category: {
                isActive: true,
            },
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: {
            id: true,
            title: true,
            company: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    if (!job) {
        throw new AppError(404, "This job is no longer available to report.");
    }

    try {
        const report = await prisma.jobReport.create({
            data: {
                jobId: job.id,
                reporterUserId,
                reason: data.reason,
                details: data.details?.trim() || null,
            },
            select: {
                id: true,
                jobId: true,
                reason: true,
                details: true,
                status: true,
                createdAt: true,
            },
        });

        await runNotificationTaskSafely(`job report submitted:${report.id}`, () =>
            createAdminJobReportNotifications({
                reportId: report.id,
                jobId: job.id,
                jobTitle: job.title,
                companyName: job.company.name,
                reasonLabel: REASON_LABELS[data.reason],
            }),
        );

        return report;
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            throw new AppError(409, "You have already reported this job. Our moderation team can review the existing report.", {
                details: { code: "JOB_ALREADY_REPORTED" },
            });
        }

        throw error;
    }
}
