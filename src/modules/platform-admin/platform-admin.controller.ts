import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import {
    createPlatformApplicationShareLink,
    getPlatformApplicationById,
    getPlatformApplicationCoverLetterDownload,
    getPlatformApplicationResumeDownload,
    getPlatformApplications,
    revokePlatformApplicationShareLink,
    updatePlatformApplicationStatus,
} from "./platform-admin-application.service.js";
import {
    createPlatformCompany,
    getPlatformCompanies,
    getPlatformCompanyById,
    updatePlatformCompany,
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
    archivePlatformManagedJob,
    createPlatformJob,
    getPlatformJobById,
    getPlatformJobs,
    publishPlatformManagedJob,
    updatePlatformJob,
    updatePlatformJobModeration,
} from "./platform-admin-job.service.js";
import {
    getPlatformJobReportById,
    getPlatformJobReports,
    updatePlatformJobReportStatus,
} from "./platform-admin-job-report.service.js";
import {
    getPlatformJobSubmissionById,
    getPlatformJobSubmissions,
    markPlatformJobSubmissionContacted,
    publishPlatformJobSubmission,
    rejectPlatformJobSubmission,
} from "./platform-admin-job-submission.service.js";
import {
    getPlatformAdminDashboard,
    getPlatformUserById,
    getPlatformUsers,
    updatePlatformUserSuspension,
} from "./platform-admin.service.js";
import type {
    AdminApplicationListQuery,
    AdminApplicationShareCreateInput,
    AdminApplicationStatusInput,
    AdminCategoryListQuery,
    AdminCompanyCreateInput,
    AdminCompanyListQuery,
    AdminCompanyUpdateInput,
    AdminJobCreateInput,
    AdminJobListQuery,
    AdminJobPublishInput,
    AdminJobUpdateInput,
    AdminJobReportListQuery,
    AdminJobSubmissionListQuery,
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


export async function getAdminApplicationsController(
    _request: Request,
    response: Response,
): Promise<void> {
    const query = response.locals.validatedQuery as AdminApplicationListQuery;
    const result = await getPlatformApplications(query);
    response.status(200).json({
        success: true,
        message: "Platform applications retrieved successfully.",
        ...result,
    });
}

export async function getAdminApplicationController(
    request: Request,
    response: Response,
): Promise<void> {
    const application = await getPlatformApplicationById(request.params.applicationId as string);
    response.status(200).json({
        success: true,
        message: "Platform application retrieved successfully.",
        application,
    });
}

export async function getAdminApplicationResumeDownloadController(
    request: Request,
    response: Response,
): Promise<void> {
    const result = await getPlatformApplicationResumeDownload(request.params.applicationId as string);
    response.status(200).json({
        success: true,
        message: "Secure resume download link created.",
        ...result,
    });
}

export async function getAdminApplicationCoverLetterDownloadController(
    request: Request,
    response: Response,
): Promise<void> {
    const result = await getPlatformApplicationCoverLetterDownload(request.params.applicationId as string);
    response.status(200).json({
        success: true,
        message: "Secure cover letter download link created.",
        ...result,
    });
}

export async function updateAdminApplicationStatusController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const application = await updatePlatformApplicationStatus(
        actorUserId,
        request.params.applicationId as string,
        request.body as AdminApplicationStatusInput,
    );
    response.status(200).json({
        success: true,
        message: "Application status updated successfully.",
        application,
    });
}

export async function createAdminApplicationShareLinkController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const shareLink = await createPlatformApplicationShareLink(
        actorUserId,
        request.params.applicationId as string,
        request.body as AdminApplicationShareCreateInput,
    );
    response.status(201).json({
        success: true,
        message: "Secure application share link created.",
        shareLink,
    });
}

export async function revokeAdminApplicationShareLinkController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const shareLink = await revokePlatformApplicationShareLink(
        actorUserId,
        request.params.applicationId as string,
        request.params.shareLinkId as string,
    );
    response.status(200).json({
        success: true,
        message: "Secure application share link revoked.",
        shareLink,
    });
}

export async function getAdminJobSubmissionsController(
    _request: Request,
    response: Response,
): Promise<void> {
    const query = response.locals.validatedQuery as AdminJobSubmissionListQuery;
    const result = await getPlatformJobSubmissions(query);

    response.status(200).json({
        success: true,
        message: "Job submissions retrieved successfully.",
        ...result,
    });
}

export async function getAdminJobSubmissionController(
    request: Request,
    response: Response,
): Promise<void> {
    const submissionId = request.params.submissionId as string;
    const submission = await getPlatformJobSubmissionById(submissionId);

    response.status(200).json({
        success: true,
        message: "Job submission retrieved successfully.",
        submission,
    });
}

export async function markAdminJobSubmissionContactedController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const submissionId = request.params.submissionId as string;
    const submission = await markPlatformJobSubmissionContacted(
        actorUserId,
        submissionId,
        request.body,
    );

    response.status(200).json({
        success: true,
        message: "Job submission marked as contacted.",
        submission,
    });
}

export async function rejectAdminJobSubmissionController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const submissionId = request.params.submissionId as string;
    const submission = await rejectPlatformJobSubmission(
        actorUserId,
        submissionId,
        request.body,
    );

    response.status(200).json({
        success: true,
        message: "Job submission rejected.",
        submission,
    });
}

export async function publishAdminJobSubmissionController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const submissionId = request.params.submissionId as string;
    const result = await publishPlatformJobSubmission(
        actorUserId,
        submissionId,
        request.body,
    );

    response.status(201).json({
        success: true,
        message: "Job submission approved and published successfully.",
        ...result,
    });
}


export async function createAdminCompanyController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const company = await createPlatformCompany(
        actorUserId,
        request.body as AdminCompanyCreateInput,
    );

    response.status(201).json({
        success: true,
        message: "Company created successfully.",
        company,
    });
}

export async function updateAdminCompanyController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const companyId = request.params.companyId as string;
    const company = await updatePlatformCompany(
        actorUserId,
        companyId,
        request.body as AdminCompanyUpdateInput,
    );

    response.status(200).json({
        success: true,
        message: "Company updated successfully.",
        company,
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


export async function createAdminJobController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const job = await createPlatformJob(
        actorUserId,
        request.body as AdminJobCreateInput,
    );

    response.status(201).json({
        success: true,
        message: "Job draft created successfully.",
        job,
    });
}

export async function updateAdminJobController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const jobId = request.params.jobId as string;
    const job = await updatePlatformJob(
        actorUserId,
        jobId,
        request.body as AdminJobUpdateInput,
    );

    response.status(200).json({
        success: true,
        message: "Job updated successfully.",
        job,
    });
}

export async function publishAdminJobController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const jobId = request.params.jobId as string;
    const job = await publishPlatformManagedJob(
        actorUserId,
        jobId,
        request.body as AdminJobPublishInput,
    );

    response.status(200).json({
        success: true,
        message: "Job published successfully.",
        job,
    });
}

export async function archiveAdminJobController(
    request: Request,
    response: Response,
): Promise<void> {
    const actorUserId = getAuthenticatedAdminId(request);
    const jobId = request.params.jobId as string;
    const job = await archivePlatformManagedJob(actorUserId, jobId);

    response.status(200).json({
        success: true,
        message: "Job archived successfully.",
        job,
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
