import type { Prisma } from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { createSlug } from "../../utils/slug.js";

import {
    PLATFORM_ADMIN_ACTIONS,
    PLATFORM_ADMIN_ENTITY_TYPES,
} from "./platform-admin.constants.js";
import { createPlatformAuditLog } from "./platform-audit.service.js";
import type {
    AdminCategoryCreateInput,
    AdminCategoryListQuery,
    AdminCategoryStatusInput,
    AdminCategoryUpdateInput,
} from "./platform-admin.validation.js";

function categorySelect() {
    return {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        displayOrder: true,
        createdAt: true,
        updatedAt: true,
        _count: {
            select: {
                jobs: { where: { deletedAt: null } },
                savedSearches: { where: { deletedAt: null } },
            },
        },
    } satisfies Prisma.JobCategorySelect;
}

function mapCategory<T extends {
    _count: { jobs: number; savedSearches: number };
}>(category: T) {
    const { _count, ...rest } = category;

    return {
        ...rest,
        counts: {
            jobs: _count.jobs,
            savedSearches: _count.savedSearches,
        },
    };
}

export async function getPlatformJobCategories(query: AdminCategoryListQuery) {
    const skip = (query.page - 1) * query.limit;

    const where: Prisma.JobCategoryWhereInput = {
        ...(query.search && {
            OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { slug: { contains: query.search, mode: "insensitive" } },
            ],
        }),
        ...(query.status === "ACTIVE" && { isActive: true }),
        ...(query.status === "INACTIVE" && { isActive: false }),
    };

    let orderBy: Prisma.JobCategoryOrderByWithRelationInput[];

    switch (query.sort) {
        case "NAME_ASC":
            orderBy = [{ name: "asc" }, { id: "asc" }];
            break;
        case "NAME_DESC":
            orderBy = [{ name: "desc" }, { id: "desc" }];
            break;
        case "NEWEST":
            orderBy = [{ createdAt: "desc" }, { id: "desc" }];
            break;
        case "ORDER_ASC":
        default:
            orderBy = [{ displayOrder: "asc" }, { name: "asc" }, { id: "asc" }];
            break;
    }

    const [categories, totalItems] = await Promise.all([
        prisma.jobCategory.findMany({
            where,
            select: categorySelect(),
            orderBy,
            skip,
            take: query.limit,
        }),
        prisma.jobCategory.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));

    return {
        categories: categories.map(mapCategory),
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

export async function createPlatformJobCategory(
    actorUserId: string,
    input: AdminCategoryCreateInput,
) {
    const name = input.name.trim();
    const slug = createSlug(name);

    if (!slug) {
        throw new AppError(400, "Category name cannot generate a valid URL slug.");
    }

    return prisma.$transaction(async (transaction) => {
        const existing = await transaction.jobCategory.findFirst({
            where: {
                OR: [
                    { name: { equals: name, mode: "insensitive" } },
                    { slug },
                ],
            },
            select: { id: true },
        });

        if (existing) {
            throw new AppError(409, "A job category with this name already exists.");
        }

        const category = await transaction.jobCategory.create({
            data: {
                name,
                slug,
                displayOrder: input.displayOrder ?? 0,
                isActive: true,
            },
            select: categorySelect(),
        });

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: PLATFORM_ADMIN_ACTIONS.JOB_CATEGORY_CREATED,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.JOB_CATEGORY,
            entityId: category.id,
            metadata: {
                categoryName: category.name,
                categorySlug: category.slug,
                displayOrder: category.displayOrder,
            },
        });

        return mapCategory(category);
    });
}

export async function updatePlatformJobCategory(
    actorUserId: string,
    categoryId: string,
    input: AdminCategoryUpdateInput,
) {
    return prisma.$transaction(async (transaction) => {
        const existing = await transaction.jobCategory.findUnique({
            where: { id: categoryId },
            select: {
                id: true,
                name: true,
                slug: true,
                displayOrder: true,
            },
        });

        if (!existing) {
            throw new AppError(404, "Job category not found.");
        }

        const nextName = input.name?.trim();

        if (nextName && nextName.toLowerCase() !== existing.name.toLowerCase()) {
            const duplicate = await transaction.jobCategory.findFirst({
                where: {
                    id: { not: categoryId },
                    name: { equals: nextName, mode: "insensitive" },
                },
                select: { id: true },
            });

            if (duplicate) {
                throw new AppError(409, "A job category with this name already exists.");
            }
        }

        const category = await transaction.jobCategory.update({
            where: { id: categoryId },
            data: {
                ...(nextName !== undefined && { name: nextName }),
                ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
            },
            select: categorySelect(),
        });

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: PLATFORM_ADMIN_ACTIONS.JOB_CATEGORY_UPDATED,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.JOB_CATEGORY,
            entityId: category.id,
            metadata: {
                previousName: existing.name,
                newName: category.name,
                categorySlug: category.slug,
                previousDisplayOrder: existing.displayOrder,
                newDisplayOrder: category.displayOrder,
            },
        });

        return mapCategory(category);
    });
}

export async function updatePlatformJobCategoryStatus(
    actorUserId: string,
    categoryId: string,
    input: AdminCategoryStatusInput,
) {
    return prisma.$transaction(async (transaction) => {
        const existing = await transaction.jobCategory.findUnique({
            where: { id: categoryId },
            select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
            },
        });

        if (!existing) {
            throw new AppError(404, "Job category not found.");
        }

        if (existing.isActive === input.active) {
            throw new AppError(
                409,
                input.active
                    ? "This job category is already active."
                    : "This job category is already inactive.",
            );
        }

        const category = await transaction.jobCategory.update({
            where: { id: categoryId },
            data: { isActive: input.active },
            select: categorySelect(),
        });

        await createPlatformAuditLog({
            transaction,
            actorUserId,
            action: input.active
                ? PLATFORM_ADMIN_ACTIONS.JOB_CATEGORY_ACTIVATED
                : PLATFORM_ADMIN_ACTIONS.JOB_CATEGORY_DEACTIVATED,
            entityType: PLATFORM_ADMIN_ENTITY_TYPES.JOB_CATEGORY,
            entityId: category.id,
            metadata: {
                categoryName: category.name,
                categorySlug: category.slug,
                affectedJobs: category._count.jobs,
            },
        });

        return mapCategory(category);
    });
}
