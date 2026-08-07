import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { uploadCoverLetter } from "../../middleware/coverLetterUpload.js";
import { requireVerifiedEmail } from "../../middleware/requireVerifiedEmail.js";
import { validate } from "../../middleware/validate.js";

import {
    createJobApplicationController,
    getJobSeekerApplicationCoverLetterDownloadController,
    getJobSeekerApplicationByIdController,
    getJobSeekerApplicationForJobController,
    getJobSeekerApplicationResumeDownloadController,
    getJobSeekerApplicationsController,
    withdrawJobApplicationController,
} from "./job-seeker-application.controller.js";

import { createJobApplicationSchema } from "./job-seeker-application.validation.js";

const jobSeekerApplicationRouter = Router();

jobSeekerApplicationRouter.use(asyncHandler(requireAuth));

// GET /api/applications
// List the authenticated job seeker's applications.
jobSeekerApplicationRouter.get(
    "/",
    asyncHandler(getJobSeekerApplicationsController),
);

// POST /api/applications
// Submit an application to one published and active job.
jobSeekerApplicationRouter.post(
    "/",
    asyncHandler(requireVerifiedEmail),
    uploadCoverLetter.single("coverLetterFile"),
    validate(createJobApplicationSchema),
    asyncHandler(createJobApplicationController),
);

// GET /api/applications/job/:jobId
// Check whether the authenticated user has applied to a job.
jobSeekerApplicationRouter.get(
    "/job/:jobId",
    asyncHandler(getJobSeekerApplicationForJobController),
);

// GET /api/applications/:applicationId/resume/download
// Create a short-lived private URL for the exact resume submitted with an application.
jobSeekerApplicationRouter.get(
    "/:applicationId/resume/download",
    asyncHandler(getJobSeekerApplicationResumeDownloadController),
);

// GET /api/applications/:applicationId/cover-letter/download
// Create a short-lived private URL for the cover letter file submitted with an application.
jobSeekerApplicationRouter.get(
    "/:applicationId/cover-letter/download",
    asyncHandler(getJobSeekerApplicationCoverLetterDownloadController),
);

// GET /api/applications/:applicationId
// Retrieve one application owned by the authenticated user.
jobSeekerApplicationRouter.get(
    "/:applicationId",
    asyncHandler(getJobSeekerApplicationByIdController),
);

// PATCH /api/applications/:applicationId/withdraw
// Withdraw an application that has not been hired or rejected.
jobSeekerApplicationRouter.patch(
    "/:applicationId/withdraw",
    asyncHandler(withdrawJobApplicationController),
);

export default jobSeekerApplicationRouter;
