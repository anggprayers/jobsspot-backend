import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import { deleteCompanyImage, uploadCompanyImage } from "./company-upload.service.js";

function getAuthenticatedUserId(request: Request) {
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

export async function uploadCompanyLogo(request: Request, response: Response) {
    if (!request.file) {
        throw new AppError(400, "Please upload a logo.");
    }

    const company = await uploadCompanyImage({
        companyId: getCompanyId(request),
        userId: getAuthenticatedUserId(request),
        imageType: "logo",
        fileBuffer: request.file.buffer,
    });

    response.json({
        success: true,
        message: "Company logo uploaded successfully.",
        company,
    });
}

export async function uploadCompanyBanner(request: Request, response: Response) {
    if (!request.file) {
        throw new AppError(400, "Please upload a banner.");
    }

    const company = await uploadCompanyImage({
        companyId: getCompanyId(request),
        userId: getAuthenticatedUserId(request),
        imageType: "banner",
        fileBuffer: request.file.buffer,
    });

    response.json({
        success: true,
        message: "Company banner uploaded successfully.",
        company,
    });
}

export async function deleteCompanyLogo(request: Request, response: Response) {
    const company = await deleteCompanyImage({
        companyId: getCompanyId(request),
        userId: getAuthenticatedUserId(request),
        imageType: "logo",
    });

    response.json({
        success: true,
        message: "Company logo deleted.",
        company,
    });
}

export async function deleteCompanyBanner(request: Request, response: Response) {
    const company = await deleteCompanyImage({
        companyId: getCompanyId(request),
        userId: getAuthenticatedUserId(request),
        imageType: "banner",
    });

    response.json({
        success: true,
        message: "Company banner deleted.",
        company,
    });
}
