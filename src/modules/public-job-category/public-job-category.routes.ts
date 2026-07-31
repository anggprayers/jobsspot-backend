import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";

import {
    getPublicJobCategoriesController,
    getPublicJobCategoryBySlugController,
} from "./public-job-category.controller.js";

const publicJobCategoryRouter = Router();

// GET /api/job-categories
// Retrieve all public job categories.
publicJobCategoryRouter.get("/", asyncHandler(getPublicJobCategoriesController));

// GET /api/job-categories/:slug
// Retrieve one public job category using its slug.
publicJobCategoryRouter.get("/:slug", asyncHandler(getPublicJobCategoryBySlugController));

export default publicJobCategoryRouter;
