import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { validate } from "../../middleware/validate.js";

import {
    createSavedSearchController,
    getSavedSearchesController,
    removeSavedSearchController,
    updateSavedSearchController,
} from "./saved-search.controller.js";

import {
    createSavedSearchSchema,
    updateSavedSearchSchema,
} from "./saved-search.validation.js";

const savedSearchRouter = Router();

savedSearchRouter.use(asyncHandler(requireAuth));

// GET /api/saved-searches
// List active saved searches owned by the authenticated user.
savedSearchRouter.get(
    "/",
    asyncHandler(getSavedSearchesController),
);

// POST /api/saved-searches
// Save a named set of job-search filters.
savedSearchRouter.post(
    "/",
    validate(createSavedSearchSchema),
    asyncHandler(createSavedSearchController),
);

// PATCH /api/saved-searches/:savedSearchId
// Rename or update an owned saved search.
savedSearchRouter.patch(
    "/:savedSearchId",
    validate(updateSavedSearchSchema),
    asyncHandler(updateSavedSearchController),
);

// DELETE /api/saved-searches/:savedSearchId
// Soft-delete an owned saved search.
savedSearchRouter.delete(
    "/:savedSearchId",
    asyncHandler(removeSavedSearchController),
);

export default savedSearchRouter;
