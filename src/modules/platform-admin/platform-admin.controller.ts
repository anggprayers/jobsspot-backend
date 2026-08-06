import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import {
    getPlatformCompanies,
    getPlatformCompanyById,
    updatePlatformCompanySuspension,
    updatePlatformCompanyVerification,
} from "./platform-admin-company.service.js";
import { getPlatformActivity } from "./platform-audit.service.js";
import {
    getPlatformAdminDashboard,
    getPlatformUserById,
    getPlatformUsers,
    updatePlatformUserSuspension,
} from "./platform-admin.service.js";
import type {
    AdminCompanyListQuery,
    AdminUserListQuery,
    PlatformActivityQuery,
} from "./platform-admin.validation.js";

function getAuthenticatedAdminId(request: Request): string {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    return request.user.id;
}

export async function getAdminDashboardController(
    _request: Request,
    response: Response,
): Promise<void> {
    const dashboard = await getPlatformAdminDashboard();

    response.status(200).json({
        success: true,
        message: "Platform dashboard retrieved successfully.",
        dashboard,
    });
}

export async function getAdminUsersController(
    _request: Request,
    response: Response,
): Promise<void> {
    const query = response.locals.validatedQuery as AdminUserListQuery;
    const result = await getPlatformUsers(query);

    response.status(200).json({
        success: true,
        message: "Platform users retrieved successfully.",
        ...result,
    });
}

export async function getAdminUserController(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = request.params.userId as string;
    const user = await getPlatformUserById(userId);

    response.status(200).json({
        success: true,
        message: "Platform user retrieved successfully.",
        user,
    });
}

export async function updateAdminUserSuspensionController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const userId = request.params.userId as string;

    const result = await updatePlatformUserSuspension(
        actorUserId,
        userId,
        request.body,
    );

    response.status(200).json({
        success: true,
        message: request.body.suspended
            ? "User account suspended successfully."
            : "User account restored successfully.",
        ...result,
    });
}

export async function getAdminCompaniesController(
    _request: Request,
    response: Response,
): Promise<void> {
    const query = response.locals.validatedQuery as AdminCompanyListQuery;
    const result = await getPlatformCompanies(query);

    response.status(200).json({
        success: true,
        message: "Platform companies retrieved successfully.",
        ...result,
    });
}

export async function getAdminCompanyController(
    request: Request,
    response: Response,
): Promise<void> {
    const companyId = request.params.companyId as string;
    const company = await getPlatformCompanyById(companyId);

    response.status(200).json({
        success: true,
        message: "Platform company retrieved successfully.",
        company,
    });
}

export async function updateAdminCompanyVerificationController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const companyId = request.params.companyId as string;

    const company = await updatePlatformCompanyVerification(
        actorUserId,
        companyId,
        request.body,
    );

    response.status(200).json({
        success: true,
        message: request.body.verified
            ? "Company verified successfully."
            : "Company verification removed successfully.",
        company,
    });
}

export async function updateAdminCompanySuspensionController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const companyId = request.params.companyId as string;

    const company = await updatePlatformCompanySuspension(
        actorUserId,
        companyId,
        request.body,
    );

    response.status(200).json({
        success: true,
        message: request.body.suspended
            ? "Company suspended successfully."
            : "Company restored successfully.",
        company,
    });
}

export async function getPlatformActivityController(
    _request: Request,
    response: Response,
): Promise<void> {
    const query = response.locals.validatedQuery as PlatformActivityQuery;
    const result = await getPlatformActivity(query);

    response.status(200).json({
        success: true,
        message: "Platform activity retrieved successfully.",
        ...result,
    });
}
