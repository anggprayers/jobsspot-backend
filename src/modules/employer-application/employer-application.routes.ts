import { Router } from "express";

import { CompanyMemberRole } from "../../generated/prisma/client.js";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireCompanyRole } from "../../middleware/requireCompanyRole.js";
import { requireVerifiedEmail } from "../../middleware/requireVerifiedEmail.js";
import { validate } from "../../middleware/validate.js";

import {
    getCompanyApplicationByIdController,
    getCompanyApplicationCoverLetterDownloadController,
    getCompanyApplicationResumeDownloadController,
    getCompanyApplicationsController,
    updateCompanyApplicationStatusController,
} from "./employer-application.controller.js";

import { updateEmployerApplicationStatusSchema } from "./employer-application.validation.js";

const employerApplicationRouter = Router({
    mergeParams: true,
});

const applicationViewingRoles = [
    CompanyMemberRole.OWNER,
    CompanyMemberRole.ADMIN,
    CompanyMemberRole.RECRUITER,
    CompanyMemberRole.VIEWER,
];

const applicationManagingRoles = [CompanyMemberRole.OWNER, CompanyMemberRole.ADMIN, CompanyMemberRole.RECRUITER];

// GET /api/companies/:companyId/applications
// Retrieve and filter applications submitted to the company's jobs.
employerApplicationRouter.get(
    "/",
    asyncHandler(requireAuth),
    requireCompanyRole(applicationViewingRoles),
    asyncHandler(getCompanyApplicationsController),
);

// GET /api/companies/:companyId/applications/:applicationId
// Retrieve the complete details of one company application.
employerApplicationRouter.get(
    "/:applicationId",
    asyncHandler(requireAuth),
    requireCompanyRole(applicationViewingRoles),
    asyncHandler(getCompanyApplicationByIdController),
);

// GET /api/companies/:companyId/applications/:applicationId/resume-download
// Create a short-lived private download URL for the exact resume attached to the application.
employerApplicationRouter.get(
    "/:applicationId/resume-download",
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    requireCompanyRole(applicationViewingRoles),
    asyncHandler(getCompanyApplicationResumeDownloadController),
);

// GET /api/companies/:companyId/applications/:applicationId/cover-letter-download
// Create a short-lived private download URL for an uploaded application cover letter.
employerApplicationRouter.get(
    "/:applicationId/cover-letter-download",
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    requireCompanyRole(applicationViewingRoles),
    asyncHandler(getCompanyApplicationCoverLetterDownloadController),
);

// PATCH /api/companies/:companyId/applications/:applicationId/status
// Update an applicant's hiring-pipeline status.
employerApplicationRouter.patch(
    "/:applicationId/status",
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    requireCompanyRole(applicationManagingRoles),
    validate(updateEmployerApplicationStatusSchema),
    asyncHandler(updateCompanyApplicationStatusController),
);

export default employerApplicationRouter;
