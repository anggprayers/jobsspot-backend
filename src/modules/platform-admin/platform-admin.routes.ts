import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { platformAdminMutationRateLimiter } from "../../middleware/rateLimit.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireVerifiedEmail } from "../../middleware/requireVerifiedEmail.js";
import { validate } from "../../middleware/validate.js";
import { validateParams } from "../../middleware/validateParams.js";
import { validateQuery } from "../../middleware/validateQuery.js";

import {
    archiveAdminJobController,
    createAdminCategoryController,
    createAdminCompanyController,
    createAdminJobController,
    getAdminCategoriesController,
    getAdminCompaniesController,
    getAdminCompanyController,
    getAdminDashboardController,
    getAdminJobController,
    getAdminJobReportController,
    getAdminJobSubmissionController,
    getAdminJobSubmissionsController,
    getAdminJobReportsController,
    getAdminJobsController,
    getAdminUserController,
    getAdminUsersController,
    getPlatformActivityController,
    markAdminJobSubmissionContactedController,
    publishAdminJobController,
    publishAdminJobSubmissionController,
    rejectAdminJobSubmissionController,
    updateAdminCompanyController,
    updateAdminCompanySuspensionController,
    updateAdminCompanyVerificationController,
    updateAdminCategoryController,
    updateAdminCategoryStatusController,
    updateAdminJobController,
    updateAdminJobModerationController,
    updateAdminJobReportStatusController,
    updateAdminUserSuspensionController,
} from "./platform-admin.controller.js";
import {
    adminCategoryCreateSchema,
    adminCategoryListQuerySchema,
    adminCategoryStatusSchema,
    adminCategoryUpdateSchema,
    adminCategoryUuidParamsSchema,
    adminCompanyCreateSchema,
    adminCompanyListQuerySchema,
    adminCompanySuspensionSchema,
    adminCompanyUpdateSchema,
    adminCompanyUuidParamsSchema,
    adminCompanyVerificationSchema,
    adminJobCreateSchema,
    adminJobListQuerySchema,
    adminJobModerationSchema,
    adminJobPublishSchema,
    adminJobUpdateSchema,
    adminJobReportListQuerySchema,
    adminJobReportStatusSchema,
    adminJobReportUuidParamsSchema,
    adminJobSubmissionContactSchema,
    adminJobSubmissionListQuerySchema,
    adminJobSubmissionPublishSchema,
    adminJobSubmissionRejectSchema,
    adminJobSubmissionUuidParamsSchema,
    adminJobUuidParamsSchema,
    adminUserListQuerySchema,
    adminUserSuspensionSchema,
    adminUuidParamsSchema,
    platformActivityQuerySchema,
} from "./platform-admin.validation.js";

const platformAdminRouter = Router();

platformAdminRouter.use(
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    requireAdmin,
);

// GET /api/admin/dashboard
platformAdminRouter.get(
    "/dashboard",
    asyncHandler(getAdminDashboardController),
);

// GET /api/admin/users
platformAdminRouter.get(
    "/users",
    validateQuery(adminUserListQuerySchema),
    asyncHandler(getAdminUsersController),
);

// GET /api/admin/users/:userId
platformAdminRouter.get(
    "/users/:userId",
    validateParams(adminUuidParamsSchema),
    asyncHandler(getAdminUserController),
);

// PATCH /api/admin/users/:userId/suspension
platformAdminRouter.patch(
    "/users/:userId/suspension",
    platformAdminMutationRateLimiter,
    validateParams(adminUuidParamsSchema),
    validate(adminUserSuspensionSchema),
    asyncHandler(updateAdminUserSuspensionController),
);


// GET /api/admin/job-submissions
platformAdminRouter.get(
    "/job-submissions",
    validateQuery(adminJobSubmissionListQuerySchema),
    asyncHandler(getAdminJobSubmissionsController),
);

// GET /api/admin/job-submissions/:submissionId
platformAdminRouter.get(
    "/job-submissions/:submissionId",
    validateParams(adminJobSubmissionUuidParamsSchema),
    asyncHandler(getAdminJobSubmissionController),
);

// PATCH /api/admin/job-submissions/:submissionId/contacted
platformAdminRouter.patch(
    "/job-submissions/:submissionId/contacted",
    platformAdminMutationRateLimiter,
    validateParams(adminJobSubmissionUuidParamsSchema),
    validate(adminJobSubmissionContactSchema),
    asyncHandler(markAdminJobSubmissionContactedController),
);

// PATCH /api/admin/job-submissions/:submissionId/reject
platformAdminRouter.patch(
    "/job-submissions/:submissionId/reject",
    platformAdminMutationRateLimiter,
    validateParams(adminJobSubmissionUuidParamsSchema),
    validate(adminJobSubmissionRejectSchema),
    asyncHandler(rejectAdminJobSubmissionController),
);

// POST /api/admin/job-submissions/:submissionId/publish
platformAdminRouter.post(
    "/job-submissions/:submissionId/publish",
    platformAdminMutationRateLimiter,
    validateParams(adminJobSubmissionUuidParamsSchema),
    validate(adminJobSubmissionPublishSchema),
    asyncHandler(publishAdminJobSubmissionController),
);

// POST /api/admin/companies
platformAdminRouter.post(
    "/companies",
    platformAdminMutationRateLimiter,
    validate(adminCompanyCreateSchema),
    asyncHandler(createAdminCompanyController),
);

// GET /api/admin/companies
platformAdminRouter.get(
    "/companies",
    validateQuery(adminCompanyListQuerySchema),
    asyncHandler(getAdminCompaniesController),
);

// GET /api/admin/companies/:companyId
platformAdminRouter.get(
    "/companies/:companyId",
    validateParams(adminCompanyUuidParamsSchema),
    asyncHandler(getAdminCompanyController),
);

// PATCH /api/admin/companies/:companyId
platformAdminRouter.patch(
    "/companies/:companyId",
    platformAdminMutationRateLimiter,
    validateParams(adminCompanyUuidParamsSchema),
    validate(adminCompanyUpdateSchema),
    asyncHandler(updateAdminCompanyController),
);

// PATCH /api/admin/companies/:companyId/verification
platformAdminRouter.patch(
    "/companies/:companyId/verification",
    platformAdminMutationRateLimiter,
    validateParams(adminCompanyUuidParamsSchema),
    validate(adminCompanyVerificationSchema),
    asyncHandler(updateAdminCompanyVerificationController),
);

// PATCH /api/admin/companies/:companyId/suspension
platformAdminRouter.patch(
    "/companies/:companyId/suspension",
    platformAdminMutationRateLimiter,
    validateParams(adminCompanyUuidParamsSchema),
    validate(adminCompanySuspensionSchema),
    asyncHandler(updateAdminCompanySuspensionController),
);

// GET /api/admin/categories
platformAdminRouter.get(
    "/categories",
    validateQuery(adminCategoryListQuerySchema),
    asyncHandler(getAdminCategoriesController),
);

// POST /api/admin/categories
platformAdminRouter.post(
    "/categories",
    platformAdminMutationRateLimiter,
    validate(adminCategoryCreateSchema),
    asyncHandler(createAdminCategoryController),
);

// PATCH /api/admin/categories/:categoryId
platformAdminRouter.patch(
    "/categories/:categoryId",
    platformAdminMutationRateLimiter,
    validateParams(adminCategoryUuidParamsSchema),
    validate(adminCategoryUpdateSchema),
    asyncHandler(updateAdminCategoryController),
);

// PATCH /api/admin/categories/:categoryId/status
platformAdminRouter.patch(
    "/categories/:categoryId/status",
    platformAdminMutationRateLimiter,
    validateParams(adminCategoryUuidParamsSchema),
    validate(adminCategoryStatusSchema),
    asyncHandler(updateAdminCategoryStatusController),
);

// POST /api/admin/jobs
platformAdminRouter.post(
    "/jobs",
    platformAdminMutationRateLimiter,
    validate(adminJobCreateSchema),
    asyncHandler(createAdminJobController),
);

// GET /api/admin/jobs
platformAdminRouter.get(
    "/jobs",
    validateQuery(adminJobListQuerySchema),
    asyncHandler(getAdminJobsController),
);

// GET /api/admin/jobs/:jobId
platformAdminRouter.get(
    "/jobs/:jobId",
    validateParams(adminJobUuidParamsSchema),
    asyncHandler(getAdminJobController),
);

// PATCH /api/admin/jobs/:jobId
platformAdminRouter.patch(
    "/jobs/:jobId",
    platformAdminMutationRateLimiter,
    validateParams(adminJobUuidParamsSchema),
    validate(adminJobUpdateSchema),
    asyncHandler(updateAdminJobController),
);

// POST /api/admin/jobs/:jobId/publish
platformAdminRouter.post(
    "/jobs/:jobId/publish",
    platformAdminMutationRateLimiter,
    validateParams(adminJobUuidParamsSchema),
    validate(adminJobPublishSchema),
    asyncHandler(publishAdminJobController),
);

// POST /api/admin/jobs/:jobId/archive
platformAdminRouter.post(
    "/jobs/:jobId/archive",
    platformAdminMutationRateLimiter,
    validateParams(adminJobUuidParamsSchema),
    asyncHandler(archiveAdminJobController),
);

// PATCH /api/admin/jobs/:jobId/moderation
platformAdminRouter.patch(
    "/jobs/:jobId/moderation",
    platformAdminMutationRateLimiter,
    validateParams(adminJobUuidParamsSchema),
    validate(adminJobModerationSchema),
    asyncHandler(updateAdminJobModerationController),
);

// GET /api/admin/reports
platformAdminRouter.get(
    "/reports",
    validateQuery(adminJobReportListQuerySchema),
    asyncHandler(getAdminJobReportsController),
);

// GET /api/admin/reports/:reportId
platformAdminRouter.get(
    "/reports/:reportId",
    validateParams(adminJobReportUuidParamsSchema),
    asyncHandler(getAdminJobReportController),
);

// PATCH /api/admin/reports/:reportId/status
platformAdminRouter.patch(
    "/reports/:reportId/status",
    platformAdminMutationRateLimiter,
    validateParams(adminJobReportUuidParamsSchema),
    validate(adminJobReportStatusSchema),
    asyncHandler(updateAdminJobReportStatusController),
);

// GET /api/admin/activity
platformAdminRouter.get(
    "/activity",
    validateQuery(platformActivityQuerySchema),
    asyncHandler(getPlatformActivityController),
);

export default platformAdminRouter;
