import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { validateQuery } from "../../middleware/validateQuery.js";

import { getPublicJobBySlugController, getPublicJobsController } from "./public-job.controller.js";

import { getPublicJobsQuerySchema } from "./public-job.validation.js";

export const publicJobRouter = Router();

// GET /api/jobs
// Retrieve published public jobs with search, filtering, and pagination.
publicJobRouter.get("/", validateQuery(getPublicJobsQuerySchema), asyncHandler(getPublicJobsController));

// GET /api/jobs/:slug
// Retrieve one published public job using its slug.
publicJobRouter.get("/:slug", asyncHandler(getPublicJobBySlugController));
