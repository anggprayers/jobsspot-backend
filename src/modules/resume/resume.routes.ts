import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { fileUploadRateLimiter, resumeProfileImportRateLimiter } from "../../middleware/rateLimit.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { uploadResume } from "../../middleware/resumeUpload.js";
import { validate } from "../../middleware/validate.js";

import {
    getResumeDownload,
    getResumes,
    makeResumeDefault,
    importResumeIntoProfile,
    previewResumeProfile,
    removeResume,
    renameResume,
    uploadResumeController,
} from "./resume.controller.js";

import { renameResumeSchema, uploadResumeSchema } from "./resume.validation.js";
import { importResumeProfileSchema } from "./resume-profile-import.validation.js";

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


// GET /api/resumes/:resumeId/profile-preview
// Extract reviewable profile suggestions from an owned PDF or DOCX resume.
resumeRouter.get(
    "/:resumeId/profile-preview",
    resumeProfileImportRateLimiter,
    asyncHandler(previewResumeProfile),
);

// POST /api/resumes/:resumeId/profile-import
// Apply only the resume fields explicitly reviewed and selected by the user.
resumeRouter.post(
    "/:resumeId/profile-import",
    resumeProfileImportRateLimiter,
    validate(importResumeProfileSchema),
    asyncHandler(importResumeIntoProfile),
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
