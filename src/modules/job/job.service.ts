import { randomUUID } from "node:crypto";

import { JobStatus, Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { createSlug } from "../../utils/slug.js";

import { AuditAction, AuditEntityType } from "../audit-log/audit-log.constants.js";
import { createCompanyAuditLog } from "../audit-log/audit-log.service.js";

import type { CreateJobInput, UpdateJobInput } from "./job.validation.js";

type GetCompanyJobsParameters = {
    companyId: string;
    search?: string;
    status?: JobStatus;
    page: number;
    limit: number;
};

type CreateJobParameters = {
    companyId: string;
    actorUserId: string;
    data: CreateJobInput;
};

type JobMutationParameters = {
    companyId: string;
    jobId: string;
    actorUserId: string;
};

type UpdateJobParameters = JobMutationParameters & {
    data: UpdateJobInput;
};

export async function createJob({ companyId, actorUserId, data }: CreateJobParameters) {
    const baseSlug = createSlug(data.title);

    if (!baseSlug) {
        throw new AppError(400, "Job title cannot generate a valid slug.");
    }

    return prisma.$transaction(async (transaction) => {
        const [company, category, existingJob] = await Promise.all([
            transaction.company.findFirst({
                where: {
                    id: companyId,
                    deletedAt: null,
                },

                select: {
                    id: true,
                },
            }),

            transaction.jobCategory.findUnique({
                where: {
                    id: data.categoryId,
                },

                select: {
                    id: true,
                },
            }),

            transaction.job.findUnique({
                where: {
                    slug: baseSlug,
                },

                select: {
                    id: true,
                },
            }),
        ]);

        if (!company) {
            throw new AppError(404, "Company not found.");
        }

        if (!category) {
            throw new AppError(404, "Job category not found.");
        }

        const slug = existingJob ? `${baseSlug}-${randomUUID().slice(0, 8)}` : baseSlug;

        const job = await transaction.job.create({
            data: {
                companyId,
                categoryId: data.categoryId,
                createdById: actorUserId,

                title: data.title,
                slug,
                description: data.description,

                requirements: data.requirements ?? null,

                responsibilities: data.responsibilities ?? null,

                employmentType: data.employmentType,

                workplaceType: data.workplaceType,

                experienceLevel: data.experienceLevel,

                location: data.location ?? null,

                salaryMin: data.salaryMin ?? null,

                salaryMax: data.salaryMax ?? null,

                salaryCurrency: data.salaryCurrency,

                salaryPeriod: data.salaryPeriod ?? null,

                applicationDeadline: data.applicationDeadline ?? null,

                status: JobStatus.DRAFT,
            },

            select: {
                id: true,
                companyId: true,
                categoryId: true,
                createdById: true,

                title: true,
                slug: true,
                description: true,
                requirements: true,
                responsibilities: true,

                employmentType: true,
                workplaceType: true,
                experienceLevel: true,
                location: true,

                salaryMin: true,
                salaryMax: true,
                salaryCurrency: true,
                salaryPeriod: true,

                status: true,
                applicationDeadline: true,
                publishedAt: true,
                expiresAt: true,

                createdAt: true,
                updatedAt: true,
            },
        });

        await createCompanyAuditLog({
            transaction,
            companyId,
            actorUserId,
            action: AuditAction.JOB_CREATED,
            entityType: AuditEntityType.JOB,
            entityId: job.id,

            metadata: {
                jobId: job.id,
                jobTitle: job.title,
                jobSlug: job.slug,
                status: job.status,
            },
        });

        return job;
    });
}
export async function getCompanyJobs({ companyId, search, status, page, limit }: GetCompanyJobsParameters) {
    const normalizedSearch = search?.trim() ?? "";

    const where: Prisma.JobWhereInput = {
        companyId,
        deletedAt: null,

        ...(status && {
            status,
        }),

        ...(normalizedSearch && {
            OR: [
                {
                    title: {
                        contains: normalizedSearch,
                        mode: "insensitive",
                    },
                },
                {
                    location: {
                        contains: normalizedSearch,
                        mode: "insensitive",
                    },
                },
                {
                    category: {
                        name: {
                            contains: normalizedSearch,
                            mode: "insensitive",
                        },
                    },
                },
            ],
        }),
    };

    const summaryWhere: Prisma.JobWhereInput = {
        companyId,
        deletedAt: null,
    };

    const skip = (page - 1) * limit;

    const [jobs, totalItems, statusCounts] = await Promise.all([
        prisma.job.findMany({
            where,

            select: {
                id: true,
                title: true,
                slug: true,

                description: true,
                requirements: true,
                responsibilities: true,

                status: true,

                employmentType: true,
                workplaceType: true,
                experienceLevel: true,

                location: true,

                salaryMin: true,
                salaryMax: true,
                salaryCurrency: true,
                salaryPeriod: true,

                applicationDeadline: true,

                publishedAt: true,
                expiresAt: true,

                createdAt: true,
                updatedAt: true,

                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },

                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },

            orderBy: {
                updatedAt: "desc",
            },

            skip,
            take: limit,
        }),

        prisma.job.count({
            where,
        }),

        prisma.job.groupBy({
            by: ["status"],
            where: summaryWhere,
            _count: {
                _all: true,
            },
        }),
    ]);

    function getStatusCount(jobStatus: JobStatus): number {
        return statusCounts.find((item) => item.status === jobStatus)?._count._all ?? 0;
    }

    const totalJobs = statusCounts.reduce((total, item) => total + item._count._all, 0);

    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return {
        jobs,

        summary: {
            totalJobs,
            publishedJobs: getStatusCount(JobStatus.PUBLISHED),
            draftJobs: getStatusCount(JobStatus.DRAFT),
            pausedJobs: getStatusCount(JobStatus.PAUSED),
            closedJobs: getStatusCount(JobStatus.CLOSED),
            archivedJobs: getStatusCount(JobStatus.ARCHIVED),
        },

        pagination: {
            page,
            limit,
            totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
        },
    };
}

export async function getCompanyJobById(companyId: string, jobId: string) {
    const job = await prisma.job.findFirst({
        where: {
            id: jobId,
            companyId,
            deletedAt: null,
        },

        select: {
            id: true,
            title: true,
            slug: true,

            description: true,
            requirements: true,
            responsibilities: true,

            employmentType: true,
            workplaceType: true,
            experienceLevel: true,

            location: true,

            salaryMin: true,
            salaryMax: true,
            salaryCurrency: true,
            salaryPeriod: true,

            status: true,

            applicationDeadline: true,
            publishedAt: true,
            expiresAt: true,

            createdAt: true,
            updatedAt: true,

            category: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },

            createdBy: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                },
            },
        },
    });

    if (!job) {
        throw new AppError(404, "Job not found for this company.");
    }

    return job;
}

export async function updateJob({ companyId, jobId, actorUserId, data }: UpdateJobParameters) {
    return prisma.$transaction(async (transaction) => {
        const existingJob = await transaction.job.findFirst({
            where: {
                id: jobId,
                companyId,
                deletedAt: null,
            },

            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                categoryId: true,
                salaryMin: true,
                salaryMax: true,
            },
        });

        if (!existingJob) {
            throw new AppError(404, "Job not found for this company.");
        }

        if (data.categoryId) {
            const category = await transaction.jobCategory.findUnique({
                where: {
                    id: data.categoryId,
                },

                select: {
                    id: true,
                },
            });

            if (!category) {
                throw new AppError(404, "Job category not found.");
            }
        }

        const salaryMin = data.salaryMin ?? (existingJob.salaryMin !== null ? Number(existingJob.salaryMin) : null);

        const salaryMax = data.salaryMax ?? (existingJob.salaryMax !== null ? Number(existingJob.salaryMax) : null);

        if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
            throw new AppError(400, "Maximum salary must be greater than or equal to minimum salary.");
        }

        let slug = existingJob.slug;

        if (data.title && data.title !== existingJob.title) {
            const baseSlug = createSlug(data.title);

            if (!baseSlug) {
                throw new AppError(400, "Job title cannot generate a valid slug.");
            }

            const conflictingJob = await transaction.job.findFirst({
                where: {
                    slug: baseSlug,

                    id: {
                        not: jobId,
                    },
                },

                select: {
                    id: true,
                },
            });

            slug = conflictingJob ? `${baseSlug}-${randomUUID().slice(0, 8)}` : baseSlug;
        }

        const updatedJob = await transaction.job.update({
            where: {
                id: jobId,
            },

            data: {
                ...(data.categoryId !== undefined && {
                    categoryId: data.categoryId,
                }),

                ...(data.title !== undefined && {
                    title: data.title,
                    slug,
                }),

                ...(data.description !== undefined && {
                    description: data.description,
                }),

                ...(data.requirements !== undefined && {
                    requirements: data.requirements,
                }),

                ...(data.responsibilities !== undefined && {
                    responsibilities: data.responsibilities,
                }),

                ...(data.employmentType !== undefined && {
                    employmentType: data.employmentType,
                }),

                ...(data.workplaceType !== undefined && {
                    workplaceType: data.workplaceType,
                }),

                ...(data.experienceLevel !== undefined && {
                    experienceLevel: data.experienceLevel,
                }),

                ...(data.location !== undefined && {
                    location: data.location,
                }),

                ...(data.salaryMin !== undefined && {
                    salaryMin: data.salaryMin,
                }),

                ...(data.salaryMax !== undefined && {
                    salaryMax: data.salaryMax,
                }),

                ...(data.salaryCurrency !== undefined && {
                    salaryCurrency: data.salaryCurrency,
                }),

                ...(data.salaryPeriod !== undefined && {
                    salaryPeriod: data.salaryPeriod,
                }),

                ...(data.applicationDeadline !== undefined && {
                    applicationDeadline: data.applicationDeadline,
                }),
            },

            select: {
                id: true,
                title: true,
                slug: true,

                description: true,
                requirements: true,
                responsibilities: true,

                employmentType: true,
                workplaceType: true,
                experienceLevel: true,
                location: true,

                salaryMin: true,
                salaryMax: true,
                salaryCurrency: true,
                salaryPeriod: true,

                status: true,

                applicationDeadline: true,
                publishedAt: true,
                expiresAt: true,

                createdAt: true,
                updatedAt: true,

                category: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },

                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        const changedFields = Object.entries(data)
            .filter(([, value]) => value !== undefined)
            .map(([field]) => field);

        await createCompanyAuditLog({
            transaction,
            companyId,
            actorUserId,
            action: AuditAction.JOB_UPDATED,
            entityType: AuditEntityType.JOB,
            entityId: updatedJob.id,

            metadata: {
                jobId: updatedJob.id,
                previousTitle: existingJob.title,
                jobTitle: updatedJob.title,
                jobSlug: updatedJob.slug,
                status: updatedJob.status,
                changedFields,
            },
        });

        return updatedJob;
    });
}

export async function deleteJob({ companyId, jobId, actorUserId }: JobMutationParameters) {
    await prisma.$transaction(async (transaction) => {
        const existingJob = await transaction.job.findFirst({
            where: {
                id: jobId,
                companyId,
                deletedAt: null,
            },

            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
            },
        });

        if (!existingJob) {
            throw new AppError(404, "Job not found for this company.");
        }

        await transaction.job.update({
            where: {
                id: jobId,
            },

            data: {
                deletedAt: new Date(),
            },
        });

        await createCompanyAuditLog({
            transaction,
            companyId,
            actorUserId,
            action: AuditAction.JOB_DELETED,
            entityType: AuditEntityType.JOB,
            entityId: existingJob.id,

            metadata: {
                jobId: existingJob.id,
                jobTitle: existingJob.title,
                jobSlug: existingJob.slug,
                previousStatus: existingJob.status,
            },
        });
    });
}

export async function publishJob({ companyId, jobId, actorUserId }: JobMutationParameters) {
    return prisma.$transaction(async (transaction) => {
        const existingJob = await transaction.job.findFirst({
            where: {
                id: jobId,
                companyId,
                deletedAt: null,
            },

            select: {
                id: true,
                status: true,

                title: true,
                slug: true,
                description: true,
                categoryId: true,

                salaryMin: true,
                salaryMax: true,
                salaryCurrency: true,
                salaryPeriod: true,

                applicationDeadline: true,

                company: {
                    select: {
                        name: true,
                        description: true,
                        industry: true,
                        location: true,
                        deletedAt: true,
                    },
                },
            },
        });

        if (!existingJob) {
            throw new AppError(404, "Job not found for this company.");
        }

        if (existingJob.status === JobStatus.PUBLISHED) {
            throw new AppError(400, "Job is already published.");
        }

        if (existingJob.status !== JobStatus.DRAFT && existingJob.status !== JobStatus.PAUSED) {
            throw new AppError(400, "Only draft or paused jobs can be published.");
        }

        const readinessIssues: string[] = [];

        if (existingJob.title.trim().length < 3) {
            readinessIssues.push("Add a valid job title.");
        }

        if (existingJob.description.trim().length < 50) {
            readinessIssues.push("The job description must contain at least 50 characters.");
        }

        if (!existingJob.categoryId) {
            readinessIssues.push("Select a job category.");
        }

        if (existingJob.applicationDeadline && existingJob.applicationDeadline <= new Date()) {
            readinessIssues.push("Set a future application deadline or remove the expired deadline.");
        }

        const hasSalary = existingJob.salaryMin !== null || existingJob.salaryMax !== null;

        if (
            existingJob.salaryMin !== null &&
            existingJob.salaryMax !== null &&
            Number(existingJob.salaryMax) < Number(existingJob.salaryMin)
        ) {
            readinessIssues.push("Maximum salary must be greater than or equal to minimum salary.");
        }

        if (hasSalary && !existingJob.salaryCurrency) {
            readinessIssues.push("Select a salary currency.");
        }

        if (hasSalary && !existingJob.salaryPeriod) {
            readinessIssues.push("Select a salary period.");
        }

        if (existingJob.company.deletedAt) {
            readinessIssues.push("The company is no longer active.");
        }

        if (!existingJob.company.name.trim()) {
            readinessIssues.push("Add the company name.");
        }

        if (!existingJob.company.description?.trim()) {
            readinessIssues.push("Complete the company description.");
        }

        if (!existingJob.company.industry?.trim()) {
            readinessIssues.push("Select the company industry.");
        }

        if (!existingJob.company.location?.trim()) {
            readinessIssues.push("Add the company location.");
        }

        if (readinessIssues.length > 0) {
            throw new AppError(400, `This job is not ready to publish. ${readinessIssues.join(" ")}`);
        }

        const previousStatus = existingJob.status;

        const job = await transaction.job.update({
            where: {
                id: jobId,
            },

            data: {
                status: JobStatus.PUBLISHED,
                publishedAt: new Date(),
            },

            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                publishedAt: true,
                updatedAt: true,
            },
        });

        await createCompanyAuditLog({
            transaction,
            companyId,
            actorUserId,
            action: AuditAction.JOB_PUBLISHED,
            entityType: AuditEntityType.JOB,
            entityId: job.id,

            metadata: {
                jobId: job.id,
                jobTitle: job.title,
                jobSlug: job.slug,
                previousStatus,
                newStatus: job.status,
            },
        });

        return job;
    });
}

export async function unpublishJob({ companyId, jobId, actorUserId }: JobMutationParameters) {
    return prisma.$transaction(async (transaction) => {
        const existingJob = await transaction.job.findFirst({
            where: {
                id: jobId,
                companyId,
                deletedAt: null,
            },

            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
            },
        });

        if (!existingJob) {
            throw new AppError(404, "Job not found for this company.");
        }

        if (existingJob.status === JobStatus.PAUSED) {
            throw new AppError(400, "Job is already paused.");
        }

        if (existingJob.status !== JobStatus.PUBLISHED) {
            throw new AppError(400, "Only published jobs can be paused.");
        }

        const previousStatus = existingJob.status;

        const job = await transaction.job.update({
            where: {
                id: jobId,
            },

            data: {
                status: JobStatus.PAUSED,
                publishedAt: null,
            },

            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                publishedAt: true,
                updatedAt: true,
            },
        });

        await createCompanyAuditLog({
            transaction,
            companyId,
            actorUserId,
            action: AuditAction.JOB_PAUSED,
            entityType: AuditEntityType.JOB,
            entityId: job.id,

            metadata: {
                jobId: job.id,
                jobTitle: job.title,
                jobSlug: job.slug,
                previousStatus,
                newStatus: job.status,
            },
        });

        return job;
    });
}

export async function archiveJob({ companyId, jobId, actorUserId }: JobMutationParameters) {
    return prisma.$transaction(async (transaction) => {
        const existingJob = await transaction.job.findFirst({
            where: {
                id: jobId,
                companyId,
                deletedAt: null,
            },

            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
            },
        });

        if (!existingJob) {
            throw new AppError(404, "Job not found for this company.");
        }

        if (existingJob.status === JobStatus.ARCHIVED) {
            throw new AppError(400, "Job is already archived.");
        }

        if (existingJob.status === JobStatus.PUBLISHED) {
            throw new AppError(400, "Pause the published job before archiving it.");
        }

        if (
            existingJob.status !== JobStatus.DRAFT &&
            existingJob.status !== JobStatus.PAUSED &&
            existingJob.status !== JobStatus.CLOSED
        ) {
            throw new AppError(400, "This job cannot currently be archived.");
        }

        const previousStatus = existingJob.status;

        const job = await transaction.job.update({
            where: {
                id: jobId,
            },

            data: {
                status: JobStatus.ARCHIVED,
                publishedAt: null,
            },

            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                publishedAt: true,
                updatedAt: true,
            },
        });

        await createCompanyAuditLog({
            transaction,
            companyId,
            actorUserId,
            action: AuditAction.JOB_ARCHIVED,
            entityType: AuditEntityType.JOB,
            entityId: job.id,

            metadata: {
                jobId: job.id,
                jobTitle: job.title,
                jobSlug: job.slug,
                previousStatus,
                newStatus: job.status,
            },
        });

        return job;
    });
}

export async function restoreJob({ companyId, jobId, actorUserId }: JobMutationParameters) {
    return prisma.$transaction(async (transaction) => {
        const existingJob = await transaction.job.findFirst({
            where: {
                id: jobId,
                companyId,
                deletedAt: null,
            },

            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
            },
        });

        if (!existingJob) {
            throw new AppError(404, "Job not found for this company.");
        }

        if (existingJob.status !== JobStatus.ARCHIVED) {
            throw new AppError(400, "Only archived jobs can be restored.");
        }

        const previousStatus = existingJob.status;

        const job = await transaction.job.update({
            where: {
                id: jobId,
            },

            data: {
                status: JobStatus.DRAFT,
                publishedAt: null,
            },

            select: {
                id: true,
                title: true,
                slug: true,
                status: true,
                publishedAt: true,
                updatedAt: true,
            },
        });

        await createCompanyAuditLog({
            transaction,
            companyId,
            actorUserId,
            action: AuditAction.JOB_RESTORED,
            entityType: AuditEntityType.JOB,
            entityId: job.id,

            metadata: {
                jobId: job.id,
                jobTitle: job.title,
                jobSlug: job.slug,
                previousStatus,
                newStatus: job.status,
            },
        });

        return job;
    });
}
