import { Router } from "express";

import { CompanyMemberRole } from "../../generated/prisma/client.js";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireCompanyRole } from "../../middleware/requireCompanyRole.js";
import { requireVerifiedEmail } from "../../middleware/requireVerifiedEmail.js";
import { validate } from "../../middleware/validate.js";

import {
    archiveJobController,
    createJob,
    deleteJobController,
    getCompanyJobByIdController,
    getCompanyJobsController,
    publishJobController,
    restoreJobController,
    unpublishJobController,
    updateJobController,
} from "./job.controller.js";

import { createJobSchema, updateJobSchema } from "./job.validation.js";

export const jobRouter = Router({
    mergeParams: true,
});

const jobViewingRoles = [
    CompanyMemberRole.OWNER,
    CompanyMemberRole.ADMIN,
    CompanyMemberRole.RECRUITER,
    CompanyMemberRole.VIEWER,
];

const jobManagingRoles = [CompanyMemberRole.OWNER, CompanyMemberRole.ADMIN, CompanyMemberRole.RECRUITER];

// GET /api/companies/:companyId/jobs
// Retrieve and filter all jobs managed by a company.
jobRouter.get(
    "/",
    asyncHandler(requireAuth),
    requireCompanyRole(jobViewingRoles),
    asyncHandler(getCompanyJobsController),
);

// POST /api/companies/:companyId/jobs
// Create a new draft job for the company.
jobRouter.post(
    "/",
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    requireCompanyRole(jobManagingRoles),
    validate(createJobSchema),
    asyncHandler(createJob),
);

// GET /api/companies/:companyId/jobs/:jobId
// Retrieve one company job, including non-public statuses.
jobRouter.get(
    "/:jobId",
    asyncHandler(requireAuth),
    requireCompanyRole(jobViewingRoles),
    asyncHandler(getCompanyJobByIdController),
);

// PATCH /api/companies/:companyId/jobs/:jobId
// Update an existing company job.
jobRouter.patch(
    "/:jobId",
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    requireCompanyRole(jobManagingRoles),
    validate(updateJobSchema),
    asyncHandler(updateJobController),
);

// DELETE /api/companies/:companyId/jobs/:jobId
// Soft-delete an existing company job.
jobRouter.delete(
    "/:jobId",
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    requireCompanyRole(jobManagingRoles),
    asyncHandler(deleteJobController),
);

// PATCH /api/companies/:companyId/jobs/:jobId/publish
// Publish a job and make it visible to job seekers.
jobRouter.patch(
    "/:jobId/publish",
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    requireCompanyRole(jobManagingRoles),
    asyncHandler(publishJobController),
);

// PATCH /api/companies/:companyId/jobs/:jobId/unpublish
// Pause or unpublish a currently published job.
jobRouter.patch(
    "/:jobId/unpublish",
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    requireCompanyRole(jobManagingRoles),
    asyncHandler(unpublishJobController),
);

// PATCH /api/companies/:companyId/jobs/:jobId/archive
// Move a company job into the archived state.
jobRouter.patch(
    "/:jobId/archive",
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    requireCompanyRole(jobManagingRoles),
    asyncHandler(archiveJobController),
);

// PATCH /api/companies/:companyId/jobs/:jobId/restore
// Restore an archived job back into the draft state.
jobRouter.patch(
    "/:jobId/restore",
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    requireCompanyRole(jobManagingRoles),
    asyncHandler(restoreJobController),
);
