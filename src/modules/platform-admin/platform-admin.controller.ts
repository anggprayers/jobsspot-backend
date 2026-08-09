import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import {
    getPlatformCompanies,
    getPlatformCompanyById,
    updatePlatformCompanySuspension,
    updatePlatformCompanyVerification,
} from "./platform-admin-company.service.js";
import {
    createPlatformJobCategory,
    getPlatformJobCategories,
    updatePlatformJobCategory,
    updatePlatformJobCategoryStatus,
} from "./platform-admin-category.service.js";
import { getPlatformActivity } from "./platform-audit.service.js";
import {
    getPlatformJobById,
    getPlatformJobs,
    updatePlatformJobModeration,
} from "./platform-admin-job.service.js";
import {
    getPlatformJobReportById,
    getPlatformJobReports,
    updatePlatformJobReportStatus,
} from "./platform-admin-job-report.service.js";
import {
    getPlatformAdminDashboard,
    getPlatformUserById,
    getPlatformUsers,
    updatePlatformUserSuspension,
} from "./platform-admin.service.js";
import type {
    AdminCategoryListQuery,
    AdminCompanyListQuery,
    AdminJobListQuery,
    AdminJobReportListQuery,
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

export async function getAdminCategoriesController(
    _request: Request,
    response: Response,
): Promise<void> {
    const query = response.locals.validatedQuery as AdminCategoryListQuery;
    const result = await getPlatformJobCategories(query);

    response.status(200).json({
        success: true,
        message: "Job categories retrieved successfully.",
        ...result,
    });
}

export async function createAdminCategoryController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const category = await createPlatformJobCategory(actorUserId, request.body);

    response.status(201).json({
        success: true,
        message: "Job category created successfully.",
        category,
    });
}

export async function updateAdminCategoryController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const categoryId = request.params.categoryId as string;
    const category = await updatePlatformJobCategory(actorUserId, categoryId, request.body);

    response.status(200).json({
        success: true,
        message: "Job category updated successfully.",
        category,
    });
}

export async function updateAdminCategoryStatusController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const categoryId = request.params.categoryId as string;
    const category = await updatePlatformJobCategoryStatus(actorUserId, categoryId, request.body);

    response.status(200).json({
        success: true,
        message: request.body.active
            ? "Job category activated successfully."
            : "Job category deactivated successfully.",
        category,
    });
}

export async function getAdminJobsController(
    _request: Request,
    response: Response,
): Promise<void> {
    const query = response.locals.validatedQuery as AdminJobListQuery;
    const result = await getPlatformJobs(query);

    response.status(200).json({
        success: true,
        message: "Platform jobs retrieved successfully.",
        ...result,
    });
}

export async function getAdminJobController(
    request: Request,
    response: Response,
): Promise<void> {
    const jobId = request.params.jobId as string;
    const job = await getPlatformJobById(jobId);

    response.status(200).json({
        success: true,
        message: "Platform job retrieved successfully.",
        job,
    });
}

export async function updateAdminJobModerationController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const jobId = request.params.jobId as string;
    const job = await updatePlatformJobModeration(actorUserId, jobId, request.body);

    response.status(200).json({
        success: true,
        message: request.body.hidden
            ? "Job hidden from public listings successfully."
            : "Job moderation hold removed successfully.",
        job,
    });
}

export async function getAdminJobReportsController(
    _request: Request,
    response: Response,
): Promise<void> {
    const query = response.locals.validatedQuery as AdminJobReportListQuery;
    const result = await getPlatformJobReports(query);

    response.status(200).json({
        success: true,
        message: "Job reports retrieved successfully.",
        ...result,
    });
}

export async function getAdminJobReportController(
    request: Request,
    response: Response,
): Promise<void> {
    const reportId = request.params.reportId as string;
    const report = await getPlatformJobReportById(reportId);

    response.status(200).json({
        success: true,
        message: "Job report retrieved successfully.",
        report,
    });
}

export async function updateAdminJobReportStatusController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const reportId = request.params.reportId as string;
    const report = await updatePlatformJobReportStatus(actorUserId, reportId, request.body);

    response.status(200).json({
        success: true,
        message: "Job report moderation status updated successfully.",
        report,
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
