import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import {
    createCompany as createCompanyService,
    getCompanyBySlug as getCompanyBySlugService,
    getManagedCompany as getManagedCompanyService,
    updateCompany as updateCompanyService,
} from "./company.service.js";

function getAuthenticatedUserId(request: Request): string {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    return request.user.id;
}

function getCompanyId(request: Request): string {
    const { companyId } = request.params;

    if (typeof companyId !== "string" || companyId.trim().length === 0) {
        throw new AppError(400, "Company ID is required.");
    }

    return companyId.trim();
}

export async function createCompany(request: Request, response: Response): Promise<void> {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    const result = await createCompanyService({
        userId: request.user.id,
        data: request.body,
    });

    response.status(201).json({
        success: true,
        message: "Company created successfully.",
        company: result.company,
        membership: result.membership,
    });
}

export async function getCompanyBySlug(request: Request, response: Response): Promise<void> {
    const slug = request.params.slug;

    if (!slug || Array.isArray(slug) || !slug.trim()) {
        throw new AppError(400, "A valid company slug is required.");
    }

    const company = await getCompanyBySlugService(slug.trim().toLowerCase());

    response.status(200).json({
        success: true,
        message: "Company retrieved successfully.",
        company,
    });
}

export async function getManagedCompany(request: Request, response: Response): Promise<void> {
    const company = await getManagedCompanyService({
        companyId: getCompanyId(request),
        userId: getAuthenticatedUserId(request),
    });

    response.status(200).json({
        success: true,
        message: "Company retrieved successfully.",
        company,
    });
}

export async function updateCompany(request: Request, response: Response): Promise<void> {
    const company = await updateCompanyService({
        companyId: getCompanyId(request),
        userId: getAuthenticatedUserId(request),
        data: request.body,
    });

    response.status(200).json({
        success: true,
        message: "Company updated successfully.",
        company,
    });
}
