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
    getAdminCompaniesController,
    getAdminCompanyController,
    getAdminDashboardController,
    getAdminUserController,
    getAdminUsersController,
    getPlatformActivityController,
    updateAdminCompanySuspensionController,
    updateAdminCompanyVerificationController,
    updateAdminUserSuspensionController,
} from "./platform-admin.controller.js";
import {
    adminCompanyListQuerySchema,
    adminCompanySuspensionSchema,
    adminCompanyUuidParamsSchema,
    adminCompanyVerificationSchema,
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

// GET /api/admin/activity
platformAdminRouter.get(
    "/activity",
    validateQuery(platformActivityQuerySchema),
    asyncHandler(getPlatformActivityController),
);

export default platformAdminRouter;
