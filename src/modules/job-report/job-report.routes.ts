import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { jobReportRateLimiter } from "../../middleware/rateLimit.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireVerifiedEmail } from "../../middleware/requireVerifiedEmail.js";
import { validate } from "../../middleware/validate.js";

import { createJobReportController } from "./job-report.controller.js";
import { createJobReportSchema } from "./job-report.validation.js";

const jobReportRouter = Router();

jobReportRouter.post(
    "/",
    jobReportRateLimiter,
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    validate(createJobReportSchema),
    asyncHandler(createJobReportController),
);

export default jobReportRouter;
