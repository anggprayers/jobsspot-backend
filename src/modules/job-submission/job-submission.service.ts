import { randomBytes } from "node:crypto";

import {
    JobSubmissionStatus,
    Prisma,
} from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { emailConfig } from "../email/email.config.js";
import { sendTransactionalEmail } from "../email/email.service.js";
import { createJobSubmissionConfirmationTemplate } from "../email/templates/job-submission-confirmation.template.js";
import { createJobSubmissionNotificationTemplate } from "../email/templates/job-submission-notification.template.js";

import { createAdminJobSubmissionNotifications } from "../notification/job-submission-notification.service.js";

import type { PublicJobSubmissionInput } from "./job-submission.validation.js";

type SubmitPublicJobParameters = {
    data: PublicJobSubmissionInput;
    ipAddress: string | null;
    userAgent: string | null;
};

const MAX_ALLOWED_DESCRIPTION_LINKS = 5;
const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_REFERENCE_ATTEMPTS = 3;

function countLinks(value: string): number {
    return value.match(/(?:https?:\/\/|www\.)[^\s]+/gi)?.length ?? 0;
}

function validateSpamSignals(data: PublicJobSubmissionInput): void {
    if (countLinks(data.description) > MAX_ALLOWED_DESCRIPTION_LINKS) {
        throw new AppError(
            400,
            "Please remove extra links from the job description and submit again.",
        );
    }
}

function createReferenceCode(now = new Date()): string {
    const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
    const randomPart = randomBytes(4).toString("hex").toUpperCase();

    return `JSJ-${datePart}-${randomPart}`;
}

function isUniqueConstraintError(error: unknown): boolean {
    return (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
    );
}

async function findRecentDuplicate(data: PublicJobSubmissionInput) {
    const duplicateSince = new Date(Date.now() - DUPLICATE_WINDOW_MS);

    return prisma.jobSubmission.findFirst({
        where: {
            contactEmail: data.contactEmail,
            jobTitle: {
                equals: data.jobTitle,
                mode: "insensitive",
            },
            companyName: {
                equals: data.companyName,
                mode: "insensitive",
            },
            createdAt: {
                gte: duplicateSince,
            },
            status: {
                not: JobSubmissionStatus.REJECTED,
            },
        },
        select: {
            referenceCode: true,
            createdAt: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
}

async function createSubmission(data: PublicJobSubmissionInput) {
    for (let attempt = 1; attempt <= MAX_REFERENCE_ATTEMPTS; attempt += 1) {
        try {
            return await prisma.jobSubmission.create({
                data: {
                    referenceCode: createReferenceCode(),
                    jobTitle: data.jobTitle,
                    companyName: data.companyName,
                    companyWebsite: data.companyWebsite ?? null,
                    locationText: data.location,
                    workplaceType: data.workplaceType,
                    employmentType: data.employmentType,
                    salaryText: data.salaryText ?? null,
                    description: data.description,
                    contactName: data.contactName ?? null,
                    contactEmail: data.contactEmail,
                    contactPhone: data.contactPhone ?? null,
                },
                select: {
                    id: true,
                    referenceCode: true,
                    jobTitle: true,
                    companyName: true,
                    companyWebsite: true,
                    locationText: true,
                    workplaceType: true,
                    employmentType: true,
                    salaryText: true,
                    description: true,
                    contactName: true,
                    contactEmail: true,
                    contactPhone: true,
                    status: true,
                    createdAt: true,
                },
            });
        } catch (error) {
            if (
                isUniqueConstraintError(error) &&
                attempt < MAX_REFERENCE_ATTEMPTS
            ) {
                continue;
            }

            throw error;
        }
    }

    throw new AppError(
        500,
        "Unable to create a job submission reference. Please try again.",
    );
}

async function sendEmailSafely(
    taskName: string,
    task: () => Promise<unknown>,
): Promise<void> {
    try {
        await task();
    } catch (error) {
        console.error(`Job submission email failed: ${taskName}`, {
            error:
                error instanceof Error
                    ? error.message
                    : String(error),
        });
    }
}

export async function submitPublicJob({
    data,
    ipAddress,
    userAgent,
}: SubmitPublicJobParameters) {
    const receivedAt = new Date();

    // Silently accept obvious bot submissions without persisting data or
    // sending email. This mirrors the existing contact-form honeypot behavior.
    if (data.website.length > 0) {
        return {
            referenceCode: createReferenceCode(receivedAt),
            status: JobSubmissionStatus.SUBMITTED,
            receivedAt,
        };
    }

    validateSpamSignals(data);

    const duplicate = await findRecentDuplicate(data);

    if (duplicate) {
        throw new AppError(
            409,
            "This job appears to have been submitted recently. Please use the existing reference instead of submitting it again.",
            {
                details: {
                    code: "JOB_SUBMISSION_DUPLICATE",
                    referenceCode: duplicate.referenceCode,
                    submittedAt: duplicate.createdAt.toISOString(),
                },
            },
        );
    }

    const submission = await createSubmission(data);

    try {
        await createAdminJobSubmissionNotifications({
            submissionId: submission.id,
            referenceCode: submission.referenceCode,
            jobTitle: submission.jobTitle,
            companyName: submission.companyName,
            contactEmail: submission.contactEmail,
        });
    } catch (error) {
        console.error("Job submission admin notification failed.", {
            submissionId: submission.id,
            referenceCode: submission.referenceCode,
            error: error instanceof Error ? error.message : String(error),
        });
    }

    const inboxEmail = createJobSubmissionNotificationTemplate({
        referenceCode: submission.referenceCode,
        receivedAt: submission.createdAt,
        jobTitle: submission.jobTitle,
        companyName: submission.companyName,
        companyWebsite: submission.companyWebsite,
        locationText: submission.locationText,
        workplaceType: submission.workplaceType,
        employmentType: submission.employmentType,
        salaryText: submission.salaryText,
        description: submission.description,
        contactName: submission.contactName,
        contactEmail: submission.contactEmail,
        contactPhone: submission.contactPhone,
        ipAddress,
        userAgent,
    });

    await sendEmailSafely(
        `JobsSpot inbox:${submission.referenceCode}`,
        () =>
            sendTransactionalEmail({
                to: emailConfig.contactInbox,
                replyTo: submission.contactEmail,
                ...inboxEmail,
                idempotencyKey: `job-submission-inbox:${submission.id}`,
            }),
    );

    const confirmationEmail = createJobSubmissionConfirmationTemplate({
        referenceCode: submission.referenceCode,
        jobTitle: submission.jobTitle,
        companyName: submission.companyName,
        contactName: submission.contactName,
    });

    await sendEmailSafely(
        `submitter confirmation:${submission.referenceCode}`,
        () =>
            sendTransactionalEmail({
                to: submission.contactEmail,
                ...confirmationEmail,
                idempotencyKey: `job-submission-confirmation:${submission.id}`,
            }),
    );

    return {
        referenceCode: submission.referenceCode,
        status: submission.status,
        receivedAt: submission.createdAt,
    };
}
