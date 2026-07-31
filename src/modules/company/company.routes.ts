import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { validate } from "../../middleware/validate.js";
import { uploadCompanyImage } from "../../middleware/companyImageUpload.js";

import { createCompany, getCompanyBySlug, getManagedCompany, updateCompany } from "./company.controller.js";

import {
    deleteCompanyBanner,
    deleteCompanyLogo,
    uploadCompanyBanner,
    uploadCompanyLogo,
} from "./company-upload.controller.js";

import { createCompanySchema, updateCompanySchema } from "./company.validation.js";

import companyMemberRouter from "../company-members/company-member.routes.js";
import employerApplicationRouter from "../employer-application/employer-application.routes.js";
import { jobRouter } from "../job/job.routes.js";

import auditLogRouter from "../audit-log/audit-log.routes.js";

const companyRouter = Router();

/*
|--------------------------------------------------------------------------
| Company creation
|--------------------------------------------------------------------------
*/

// POST /api/companies
// Create a new company and assign the authenticated user as its owner.
companyRouter.post("/", asyncHandler(requireAuth), validate(createCompanySchema), asyncHandler(createCompany));

/*
|--------------------------------------------------------------------------
| Company branding
|--------------------------------------------------------------------------
*/

// PATCH /api/companies/:companyId/logo
// Upload or replace the company logo.
companyRouter.patch(
    "/:companyId/logo",
    asyncHandler(requireAuth),
    uploadCompanyImage.single("image"),
    asyncHandler(uploadCompanyLogo),
);

// PATCH /api/companies/:companyId/banner
// Upload or replace the company banner.
companyRouter.patch(
    "/:companyId/banner",
    asyncHandler(requireAuth),
    uploadCompanyImage.single("image"),
    asyncHandler(uploadCompanyBanner),
);

// DELETE /api/companies/:companyId/logo
// Delete the current company logo.
companyRouter.delete("/:companyId/logo", asyncHandler(requireAuth), asyncHandler(deleteCompanyLogo));

// DELETE /api/companies/:companyId/banner
// Delete the current company banner.
companyRouter.delete("/:companyId/banner", asyncHandler(requireAuth), asyncHandler(deleteCompanyBanner));

/*
|--------------------------------------------------------------------------
| Company-specific authenticated modules
|--------------------------------------------------------------------------
*/

// Mounts employer job routes at:
// /api/companies/:companyId/jobs
companyRouter.use("/:companyId/jobs", jobRouter);

// Mounts employer application routes at:
// /api/companies/:companyId/applications
companyRouter.use("/:companyId/applications", employerApplicationRouter);

// Mounts company member routes at:
// /api/companies/:companyId/members
companyRouter.use("/:companyId/members", companyMemberRouter);

// Mounts company activity routes at:
// /api/companies/:companyId/activity
companyRouter.use("/:companyId/activity", auditLogRouter);

/*
|--------------------------------------------------------------------------
| Managed company profile
|--------------------------------------------------------------------------
*/

// GET /api/companies/:companyId/manage
// Retrieve company information for the authenticated employer workspace.
companyRouter.get("/:companyId/manage", asyncHandler(requireAuth), asyncHandler(getManagedCompany));

// PATCH /api/companies/:companyId
// Update the managed company's profile information.
companyRouter.patch(
    "/:companyId",
    asyncHandler(requireAuth),
    validate(updateCompanySchema),
    asyncHandler(updateCompany),
);

/*
|--------------------------------------------------------------------------
| Public company profile
|--------------------------------------------------------------------------
*/

// GET /api/companies/:slug
// Retrieve a public company profile using its slug.
companyRouter.get("/:slug", asyncHandler(getCompanyBySlug));

export default companyRouter;
