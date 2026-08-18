import { Router } from "express";

import { applicationShareRateLimiter } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
    getSharedApplicationController,
    getSharedCoverLetterDownloadController,
    getSharedResumeDownloadController,
} from "./application-share.controller.js";

const applicationShareRouter = Router();
applicationShareRouter.use(applicationShareRateLimiter);

applicationShareRouter.get("/:token", asyncHandler(getSharedApplicationController));
applicationShareRouter.get("/:token/resume-download", asyncHandler(getSharedResumeDownloadController));
applicationShareRouter.get("/:token/cover-letter-download", asyncHandler(getSharedCoverLetterDownloadController));

export default applicationShareRouter;
