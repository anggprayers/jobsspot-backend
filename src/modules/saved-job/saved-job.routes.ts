import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";

import {
    getSavedJobsController,
    getSavedJobStatusController,
    removeSavedJobController,
    saveJobController,
} from "./saved-job.controller.js";

const savedJobRouter = Router();

savedJobRouter.use(asyncHandler(requireAuth));

// GET /api/saved-jobs
// List the authenticated user's saved jobs.
savedJobRouter.get(
    "/",
    asyncHandler(getSavedJobsController),
);

// GET /api/saved-jobs/job/:jobId
// Check whether one job is saved by the authenticated user.
savedJobRouter.get(
    "/job/:jobId",
    asyncHandler(getSavedJobStatusController),
);

// POST /api/saved-jobs/:jobId
// Save one published and active job.
savedJobRouter.post(
    "/:jobId",
    asyncHandler(saveJobController),
);

// DELETE /api/saved-jobs/:jobId
// Remove one job from the authenticated user's saved jobs.
savedJobRouter.delete(
    "/:jobId",
    asyncHandler(removeSavedJobController),
);

export default savedJobRouter;
