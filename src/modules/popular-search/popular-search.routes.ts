import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { validate } from "../../middleware/validate.js";

import {
    getPopularSearchesController,
    trackPopularSearchController,
} from "./popular-search.controller.js";

import { trackPopularSearchSchema } from "./popular-search.validation.js";

const popularSearchRouter = Router();

// GET /api/popular-searches?limit=4&days=30
// Return the most submitted search keywords in the selected period.
popularSearchRouter.get(
    "/",
    asyncHandler(getPopularSearchesController),
);

// POST /api/popular-searches/track
// Track only explicit search-form submissions.
popularSearchRouter.post(
    "/track",
    validate(trackPopularSearchSchema),
    asyncHandler(trackPopularSearchController),
);

export default popularSearchRouter;
