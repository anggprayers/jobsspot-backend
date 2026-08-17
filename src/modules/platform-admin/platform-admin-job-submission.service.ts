import { randomUUID } from "node:crypto";

import {
    JobStatus,
    JobSubmissionStatus,
    Prisma,
} from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { createSlug } from "../../utils/slug.js";

import {
    formatStructuredJobLocation,
    getStructuredJobLocationIssues,
    normalizeJobCountryCode,
    normalizeJobLocationPart,
    normalizeJobStateRegion,
} from "../job/job-location.js";

import {
    PLATFORM_ADMIN_ACTIONS,
    PLATFORM_ADMIN_ENTITY_TYPES,
} from "./platform-admin.constants.js";
import { createPlatformAuditLog } from "./platform-audit.service.js";
import type {
    AdminJobSubmissionContactInput,
    AdminJobSubmissionListQuery,
    AdminJobSubmissionPublishInput,
    AdminJobSubmissionRejectInput,
} from "./platform-admin.validation.js";

const JOB_SUBMISSION_REVIEW_LOCK_NAMESPACE = 204816031;
const JOB_POST_DURATION_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function calculateJobExpirationDate({
    publishedAt,
    applicationDeadline,
}: {
    publishedAt: Date;
    applicationDeadline: Date | null;
}): Date {
    const defaultExpiration = new Date(
        publishedAt.getTime() + JOB_POST_DURATION_DAYS * MILLISECONDS_PER_DAY,
    );

    if (applicationDeadline && applicationDeadline < defaultExpiration) {
        return applicationDeadline;
    }

    return defaultExpiration;
}

async function lockJobSubmission(
    transaction: Prisma.TransactionClient,
    submissionId: string,
): Promise<void> {
    await transaction.$queryRaw<Array<{ lockResult: string }>>`
        SELECT pg_advisory_xact_lock(
            ${JOB_SUBMISSION_REVIEW_LOCK_NAMESPACE},
            hashtext(${submissionId}::text)
        )::text AS "lockResult"
    `;
}

async function createUniqueCompanySlug(
    transaction: Prisma.TransactionClient,
    name: string,
): Promise<string> {
    const baseSlug = createSlug(name);

    if (!baseSlug) {
        throw new AppError(400, "Company name cannot generate a valid URL slug.");
    }

    const existing = await transaction.company.findUnique({
        where: { slug: baseSlug },
        select: { id: true },
    });

    return existing ? `${baseSlug}-${randomUUID().slice(0, 8)}` : baseSlug;
}

async function createUniqueJobSlug(
    transaction: Prisma.TransactionClient,
    title: string,
): Promise<string> {
    const baseSlug = createSlug(title);

    if (!baseSlug) {
        throw new AppError(400, "Job title cannot generate a valid URL slug.");
    }

    const existing = await transaction.job.findUnique({
        where: { slug: baseSlug },
        select: { id: true },
    });

    return existing ? `${baseSlug}-${randomUUID().slice(0, 8)}` : baseSlug;
}

const submissionListSelect = {
    id: true,
    referenceCode: true,
    jobTitle: true,
    companyName: true,
    locationText: true,
    workplaceType: true,
    employmentType: true,
    salaryText: true,
    contactName: true,
    contactEmail: true,
    contactPhone: true,
    status: true,
    contactedAt: true,
    reviewedAt: true,
    approvedAt: true,
    rejectedAt: true,
    publishedAt: true,
    createdAt: true,
    updatedAt: true,
    companyId: true,
    publishedJobId: true,
    reviewedBy: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
        },
    },
} satisfies Prisma.JobSubmissionSelect;

export async function getPlatformJobSubmissions(
    query: AdminJobSubmissionListQuery,
) {
    const where: Prisma.JobSubmissionWhereInput = {
        ...(query.status !== "ALL" && { status: query.status }),
        ...(query.search && {
            OR: [
                {
                    referenceCode: {
                        contains: query.search,
                        mode: "insensitive",
                    },
                },
                {
                    jobTitle: {
                        contains: query.search,
                        mode: "insensitive",
                    },
                },
                {
                    companyName: {
                        contains: query.search,
                        mode: "insensitive",
                    },
                },
                {
                    contactEmail: {
                        contains: query.search,
                        mode: "insensitive",
                    },
                },
            ],
        }),
    };

    const orderBy: Prisma.JobSubmissionOrderByWithRelationInput[] =
        query.sort === "OLDEST"
            ? [{ createdAt: "asc" }, { id: "asc" }]
            : [{ createdAt: "desc" }, { id: "desc" }];

    const skip = (query.page - 1) * query.limit;

    const [submissions, totalItems, groupedStatuses] = await Promise.all([
        prisma.jobSubmission.findMany({
            where,
            select: submissionListSelect,
            orderBy,
            skip,
            take: query.limit,
        }),
        prisma.jobSubmission.count({ where }),
        prisma.jobSubmission.groupBy({
            by: ["status"],
            _count: { _all: true },
        }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));

    const statusCounts = Object.fromEntries(
        Object.values(JobSubmissionStatus).map((status) => [
            status,
            groupedStatuses.find((item) => item.status === status)?._count._all ?? 0,
        ]),
    );

    return {
        submissions,
        summary: {
            total: groupedStatuses.reduce((sum, item) => sum + item._count._all, 0),
            byStatus: statusCounts,
        },
        pagination: {
            page: query.page,
            limit: query.limit,
            totalItems,
            totalPages,
            hasNextPage: query.page < totalPages,
            hasPreviousPage: query.page > 1,
        },
    };
}

export async function getPlatformJobSubmissionById(submissionId: string) {
    const submission = await prisma.jobSubmission.findUnique({
        where: { id: submissionId },
        select: {
            ...submissionListSelect,
            companyWebsite: true,
            description: true,
            internalNotes: true,
            company: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    websiteUrl: true,
                    location: true,
                    isVerified: true,
                    suspendedAt: true,
                    deletedAt: true,
                },
            },
            publishedJob: {
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    status: true,
                    publishedAt: true,
                    expiresAt: true,
                    deletedAt: true,
                },
            },
        },
    });

    if (!submission) {
        throw new AppError(404, "Job submission not found.");
    }

    return submission;
}

function assertReviewableSubmission(status: JobSubmissionStatus): void {
    if (
        status === JobSubmissionStatus.REJECTED ||
        status === JobSubmissionStatus.PUBLISHED
    ) {
        throw new AppError(
            409,
            "This job submission has already reached a final review state.",
        );
    }
}

export async function markPlatformJobSubmissionContacted(
    actorUserId: string,
    submissionId: string,
    input: AdminJobSubmissionContactInput,
) {
    return prisma.$transaction(async (transaction) => {
        await lockJobSubmission(transaction, submissionId);

        const target = await transaction.jobSubmission.findUnique({
            where: { id: submissionId },
            select: {
                id: true,
                referenceCode: true,
                jobTitle: true,
                companyName: true,
                contactEmail: true,
                status: true,
            },
        });

        if (!target) {
            throw new AppError(404, "Job submission not found.");
        }

        assertReviewableSubmission(target.status);

        if (target.status === JobSubmissionStatus.CONTACTED) {
            throw new AppError(409, "This job submission is already marked as contacted.");
        }

        const now = new Date();
        const submission = await transaction.jobSubmission.update({
            where: { id: submissionId },
            data: {
                status: JobSubmissionStatus.CONTACTED,
                contactedAt: now,
                reviewedAt: now,
                reviewedById: actorUserId,
                ...(input.internalNotes !== undefined && {
                    internalNotes: input.internalNotes || null,
                }),
            },
            select: submissionListSelect,
        });

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: PLATFORM_ADMIN_ACTIONS.JOB_SUBMISSION_CONTACTED,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.JOB_SUBMISSION,
            entityId: target.id,
            metadata: {
                referenceCode: target.referenceCode,
                jobTitle: target.jobTitle,
                companyName: target.companyName,
                contactEmail: target.contactEmail,
            },
        });

        return submission;
    });
}

export async function rejectPlatformJobSubmission(
    actorUserId: string,
    submissionId: string,
    input: AdminJobSubmissionRejectInput,
) {
    return prisma.$transaction(async (transaction) => {
        await lockJobSubmission(transaction, submissionId);

        const target = await transaction.jobSubmission.findUnique({
            where: { id: submissionId },
            select: {
                id: true,
                referenceCode: true,
                jobTitle: true,
                companyName: true,
                contactEmail: true,
                status: true,
            },
        });

        if (!target) {
            throw new AppError(404, "Job submission not found.");
        }

        assertReviewableSubmission(target.status);

        const now = new Date();
        const submission = await transaction.jobSubmission.update({
            where: { id: submissionId },
            data: {
                status: JobSubmissionStatus.REJECTED,
                rejectedAt: now,
                reviewedAt: now,
                reviewedById: actorUserId,
                internalNotes: input.reason,
            },
            select: submissionListSelect,
        });

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: PLATFORM_ADMIN_ACTIONS.JOB_SUBMISSION_REJECTED,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.JOB_SUBMISSION,
            entityId: target.id,
            metadata: {
                referenceCode: target.referenceCode,
                jobTitle: target.jobTitle,
                companyName: target.companyName,
                contactEmail: target.contactEmail,
                reason: input.reason,
            },
        });

        return submission;
    });
}

export async function publishPlatformJobSubmission(
    actorUserId: string,
    submissionId: string,
    input: AdminJobSubmissionPublishInput,
) {
    return prisma.$transaction(async (transaction) => {
        await lockJobSubmission(transaction, submissionId);

        const target = await transaction.jobSubmission.findUnique({
            where: { id: submissionId },
            select: {
                id: true,
                referenceCode: true,
                jobTitle: true,
                companyName: true,
                companyWebsite: true,
                locationText: true,
                contactEmail: true,
                status: true,
                publishedJobId: true,
            },
        });

        if (!target) {
            throw new AppError(404, "Job submission not found.");
        }

        assertReviewableSubmission(target.status);

        if (target.publishedJobId) {
            throw new AppError(409, "This submission is already linked to a published job.");
        }

        let company: {
            id: string;
            name: string;
            slug: string;
            websiteUrl: string | null;
            location: string | null;
        };
        let createdCompany = false;

        if (input.company.mode === "EXISTING") {
            const existingCompany = await transaction.company.findFirst({
                where: {
                    id: input.company.companyId,
                    deletedAt: null,
                    suspendedAt: null,
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    websiteUrl: true,
                    location: true,
                },
            });

            if (!existingCompany) {
                throw new AppError(404, "Active company not found.");
            }

            company = existingCompany;
        } else {
            const slug = await createUniqueCompanySlug(
                transaction,
                input.company.name,
            );

            company = await transaction.company.create({
                data: {
                    name: input.company.name,
                    slug,
                    description: input.company.description ?? null,
                    websiteUrl: input.company.websiteUrl ?? null,
                    industry: input.company.industry ?? null,
                    companySize: input.company.companySize ?? null,
                    location: input.company.location ?? null,
                },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    websiteUrl: true,
                    location: true,
                },
            });
            createdCompany = true;

            await createPlatformAuditLog({
                transaction,
                actorUserId,
                action: PLATFORM_ADMIN_ACTIONS.COMPANY_CREATED_FROM_JOB_SUBMISSION,
                entityType: PLATFORM_ADMIN_ENTITY_TYPES.COMPANY,
                entityId: company.id,
                metadata: {
                    companyId: company.id,
                    companyName: company.name,
                    companySlug: company.slug,
                    sourceSubmissionId: target.id,
                    referenceCode: target.referenceCode,
                },
            });
        }

        const category = await transaction.jobCategory.findFirst({
            where: {
                id: input.job.categoryId,
                isActive: true,
            },
            select: {
                id: true,
                name: true,
            },
        });

        if (!category) {
            throw new AppError(400, "Select an active job category.");
        }

        const city = normalizeJobLocationPart(input.job.city);
        const countryCode = normalizeJobCountryCode(input.job.countryCode);
        const stateRegion = normalizeJobStateRegion(
            input.job.stateRegion,
            countryCode,
        );
        const locationIssues = getStructuredJobLocationIssues({
            workplaceType: input.job.workplaceType,
            city,
            stateRegion,
            countryCode,
        });

        if (locationIssues.length > 0) {
            throw new AppError(400, locationIssues.join(" "));
        }

        const location = formatStructuredJobLocation({
            city,
            stateRegion,
            countryCode,
        });
        const slug = await createUniqueJobSlug(transaction, input.job.title);
        const now = new Date();
        const applicationDeadline = input.job.applicationDeadline ?? null;
        const expiresAt = calculateJobExpirationDate({
            publishedAt: now,
            applicationDeadline,
        });

        const job = await transaction.job.create({
            data: {
                companyId: company.id,
                categoryId: input.job.categoryId,
                createdById: actorUserId,
                title: input.job.title,
                slug,
                description: input.job.description,
                requirements: input.job.requirements ?? null,
                responsibilities: input.job.responsibilities ?? null,
                employmentType: input.job.employmentType,
                workplaceType: input.job.workplaceType,
                experienceLevel: input.job.experienceLevel,
                location,
                city,
                stateRegion,
                countryCode,
                salaryMin: input.job.salaryMin ?? null,
                salaryMax: input.job.salaryMax ?? null,
                salaryCurrency: input.job.salaryCurrency,
                salaryPeriod: input.job.salaryPeriod ?? null,
                applicationDeadline,
                status: JobStatus.PUBLISHED,
                publishedAt: now,
                expiresAt,
            },
            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                publishedAt: true,
                expiresAt: true,
                companyId: true,
                categoryId: true,
            },
        });

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: PLATFORM_ADMIN_ACTIONS.JOB_CREATED_FROM_SUBMISSION,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.JOB,
            entityId: job.id,
            metadata: {
                jobId: job.id,
                jobTitle: job.title,
                jobSlug: job.slug,
                companyId: company.id,
                companyName: company.name,
                categoryId: category.id,
                categoryName: category.name,
                sourceSubmissionId: target.id,
                referenceCode: target.referenceCode,
            },
        });

        const submission = await transaction.jobSubmission.update({
            where: { id: submissionId },
            data: {
                status: JobSubmissionStatus.PUBLISHED,
                reviewedById: actorUserId,
                reviewedAt: now,
                approvedAt: now,
                publishedAt: now,
                companyId: company.id,
                publishedJobId: job.id,
                ...(input.internalNotes !== undefined && {
                    internalNotes: input.internalNotes || null,
                }),
            },
            select: {
                ...submissionListSelect,
                company: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                publishedJob: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        status: true,
                        publishedAt: true,
                        expiresAt: true,
                    },
                },
            },
        });

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: PLATFORM_ADMIN_ACTIONS.JOB_SUBMISSION_PUBLISHED,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.JOB_SUBMISSION,
            entityId: target.id,
            metadata: {
                referenceCode: target.referenceCode,
                originalJobTitle: target.jobTitle,
                originalCompanyName: target.companyName,
                contactEmail: target.contactEmail,
                companyId: company.id,
                companyName: company.name,
                companyCreated: createdCompany,
                jobId: job.id,
                jobTitle: job.title,
                jobSlug: job.slug,
            },
        });

        return {
            submission,
            company,
            job,
        };
    });
}
