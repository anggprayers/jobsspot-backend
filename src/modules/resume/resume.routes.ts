import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { fileUploadRateLimiter } from "../../middleware/rateLimit.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { uploadResume } from "../../middleware/resumeUpload.js";
import { validate } from "../../middleware/validate.js";

import {
    getResumeDownload,
    getResumes,
    makeResumeDefault,
    removeResume,
    renameResume,
    uploadResumeController,
} from "./resume.controller.js";

import { renameResumeSchema, uploadResumeSchema } from "./resume.validation.js";

const resumeRouter = Router();

resumeRouter.use(asyncHandler(requireAuth));

// GET /api/resumes
// List the authenticated user's active resumes.
resumeRouter.get("/", asyncHandler(getResumes));

// POST /api/resumes
// Upload one private resume using multipart/form-data.
// File field: resume
// Optional text fields: name, isDefault
resumeRouter.post(
    "/",
    fileUploadRateLimiter,
    uploadResume.single("resume"),
    validate(uploadResumeSchema),
    asyncHandler(uploadResumeController),
);

// PATCH /api/resumes/:resumeId
// Rename an owned active resume.
resumeRouter.patch("/:resumeId", validate(renameResumeSchema), asyncHandler(renameResume));

// PATCH /api/resumes/:resumeId/default
// Set an owned active resume as the default.
resumeRouter.patch("/:resumeId/default", asyncHandler(makeResumeDefault));

// GET /api/resumes/:resumeId/download
// Create a short-lived private R2 download URL.
resumeRouter.get("/:resumeId/download", asyncHandler(getResumeDownload));

// DELETE /api/resumes/:resumeId
// Soft-delete an owned active resume.
resumeRouter.delete("/:resumeId", asyncHandler(removeResume));

export default resumeRouter;
