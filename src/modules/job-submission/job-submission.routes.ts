import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { jobSubmissionRateLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";

import { submitPublicJobController } from "./job-submission.controller.js";
import { publicJobSubmissionSchema } from "./job-submission.validation.js";

const jobSubmissionRouter = Router();

// POST /api/job-submissions
// Public, account-free job intake. Submissions are staged for JobsSpot review
// and are never published directly from this endpoint.
jobSubmissionRouter.post(
    "/",
    jobSubmissionRateLimiter,
    validate(publicJobSubmissionSchema),
    asyncHandler(submitPublicJobController),
);

export default jobSubmissionRouter;
