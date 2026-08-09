import { randomUUID } from "node:crypto";

import { CompanyMemberRole, JobStatus, Prisma } from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { createSlug } from "../../utils/slug.js";

import { AuditAction, AuditEntityType } from "../audit-log/audit-log.constants.js";
import { createCompanyAuditLog } from "../audit-log/audit-log.service.js";

import type { CreateCompanyInput, UpdateCompanyInput } from "./company.validation.js";

const managedCompanySelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    websiteUrl: true,
    logoUrl: true,
    bannerUrl: true,
    industry: true,
    companySize: true,
    location: true,
    isVerified: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.CompanySelect;

type CreateCompanyParameters = {
    userId: string;
    data: CreateCompanyInput;
};

export async function createCompany({ userId, data }: CreateCompanyParameters) {
    const baseSlug = createSlug(data.name);

    if (!baseSlug) {
        throw new AppError(400, "Company name cannot generate a valid slug.");
    }

    const existingCompany = await prisma.company.findUnique({
        where: {
            slug: baseSlug,
        },

        select: {
            id: true,
        },
    });

    const slug = existingCompany ? `${baseSlug}-${randomUUID().slice(0, 8)}` : baseSlug;

    return prisma.$transaction(async (transaction) => {
        const company = await transaction.company.create({
            data: {
                name: data.name,
                slug,
                description: data.description ?? null,
                websiteUrl: data.websiteUrl ?? null,
                industry: data.industry ?? null,
                companySize: data.companySize ?? null,
                location: data.location ?? null,
            },

            select: managedCompanySelect,
        });

        const membership = await transaction.companyMembership.create({
            data: {
                companyId: company.id,
                userId,
                role: CompanyMemberRole.OWNER,
            },

            select: {
                id: true,
                companyId: true,
                userId: true,
                role: true,
                joinedAt: true,
            },
        });

        await createCompanyAuditLog({
            transaction,
            companyId: company.id,
            actorUserId: userId,
            action: AuditAction.COMPANY_CREATED,
            entityType: AuditEntityType.COMPANY,
            entityId: company.id,

            metadata: {
                companyId: company.id,
                companyName: company.name,
                companySlug: company.slug,
            },
        });

        return {
            company,
            membership,
        };
    });
}

export async function getCompanyBySlug(slug: string) {
    const now = new Date();

    const company = await prisma.company.findFirst({
        where: {
            slug,
            deletedAt: null,
            suspendedAt: null,
        },

        select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            websiteUrl: true,
            logoUrl: true,
            bannerUrl: true,
            industry: true,
            companySize: true,
            location: true,
            isVerified: true,
            createdAt: true,
            updatedAt: true,

            jobs: {
                where: {
                    status: JobStatus.PUBLISHED,
                    deletedAt: null,
                    adminHiddenAt: null,
                    category: { isActive: true },

                    OR: [
                        {
                            expiresAt: null,
                        },
                        {
                            expiresAt: {
                                gt: now,
                            },
                        },
                    ],
                },

                select: {
                    id: true,
                    title: true,
                    slug: true,
                    employmentType: true,
                    workplaceType: true,
                    experienceLevel: true,
                    location: true,
                    city: true,
                    stateRegion: true,
                    countryCode: true,
                    salaryMin: true,
                    salaryMax: true,
                    salaryCurrency: true,
                    salaryPeriod: true,
                    publishedAt: true,
                    updatedAt: true,
                    createdAt: true,

                    category: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },

                orderBy: [
                    {
                        publishedAt: "desc",
                    },
                    {
                        createdAt: "desc",
                    },
                ],
            },
        },
    });

    if (!company) {
        throw new AppError(404, "Company not found.");
    }

    const { jobs, ...companyDetails } = company;

    return {
        ...companyDetails,
        openJobsCount: jobs.length,
        jobs,
    };
}

type CompanyAccessParameters = {
    companyId: string;
    userId: string;
};

type UpdateCompanyParameters = CompanyAccessParameters & {
    data: UpdateCompanyInput;
};

async function requireCompanyManagementAccess({ companyId, userId }: CompanyAccessParameters) {
    const company = await prisma.company.findFirst({
        where: {
            id: companyId,
            deletedAt: null,
        },
        select: {
            id: true,
            suspendedAt: true,
        },
    });

    if (!company) {
        throw new AppError(404, "Company not found.");
    }

    if (company.suspendedAt) {
        throw new AppError(
            403,
            "This company workspace has been suspended. Contact JobsSpot support for assistance.",
        );
    }

    const membership = await prisma.companyMembership.findFirst({
        where: {
            companyId,
            userId,
            deletedAt: null,

            role: {
                in: [CompanyMemberRole.OWNER, CompanyMemberRole.ADMIN],
            },
        },

        select: {
            id: true,
            role: true,
        },
    });

    if (!membership) {
        throw new AppError(403, "Only company owners and administrators can manage this company.");
    }

    return membership;
}

export async function getManagedCompany({ companyId, userId }: CompanyAccessParameters) {
    await requireCompanyManagementAccess({
        companyId,
        userId,
    });

    const company = await prisma.company.findFirst({
        where: {
            id: companyId,
            deletedAt: null,
        },

        select: managedCompanySelect,
    });

    if (!company) {
        throw new AppError(404, "Company not found.");
    }

    return company;
}

export async function updateCompany({ companyId, userId, data }: UpdateCompanyParameters) {
    await requireCompanyManagementAccess({
        companyId,
        userId,
    });

    return prisma.$transaction(async (transaction) => {
        const existingCompany = await transaction.company.findFirst({
            where: {
                id: companyId,
                deletedAt: null,
            },

            select: managedCompanySelect,
        });

        if (!existingCompany) {
            throw new AppError(404, "Company not found.");
        }

        const description = data.description !== undefined ? data.description || null : undefined;

        const websiteUrl = data.websiteUrl !== undefined ? data.websiteUrl || null : undefined;

        const industry = data.industry !== undefined ? data.industry || null : undefined;

        const companySize = data.companySize !== undefined ? data.companySize || null : undefined;

        const location = data.location !== undefined ? data.location || null : undefined;

        const changedFields: string[] = [];

        if (data.name !== undefined && data.name !== existingCompany.name) {
            changedFields.push("name");
        }

        if (description !== undefined && description !== existingCompany.description) {
            changedFields.push("description");
        }

        if (websiteUrl !== undefined && websiteUrl !== existingCompany.websiteUrl) {
            changedFields.push("websiteUrl");
        }

        if (industry !== undefined && industry !== existingCompany.industry) {
            changedFields.push("industry");
        }

        if (companySize !== undefined && companySize !== existingCompany.companySize) {
            changedFields.push("companySize");
        }

        if (location !== undefined && location !== existingCompany.location) {
            changedFields.push("location");
        }

        /*
         * Avoid creating misleading activity records
         * when submitted values are unchanged.
         */
        if (changedFields.length === 0) {
            return existingCompany;
        }

        const company = await transaction.company.update({
            where: {
                id: companyId,
            },

            data: {
                ...(data.name !== undefined && {
                    name: data.name,
                }),

                ...(description !== undefined && {
                    description,
                }),

                ...(websiteUrl !== undefined && {
                    websiteUrl,
                }),

                ...(industry !== undefined && {
                    industry,
                }),

                ...(companySize !== undefined && {
                    companySize,
                }),

                ...(location !== undefined && {
                    location,
                }),
            },

            select: managedCompanySelect,
        });

        await createCompanyAuditLog({
            transaction,
            companyId,
            actorUserId: userId,
            action: AuditAction.COMPANY_PROFILE_UPDATED,
            entityType: AuditEntityType.COMPANY,
            entityId: company.id,

            metadata: {
                companyId: company.id,
                companyName: company.name,
                previousCompanyName: existingCompany.name,
                changedFields,
            },
        });

        return company;
    });
}
