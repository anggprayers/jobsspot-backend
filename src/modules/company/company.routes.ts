import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";

import { getCompanyBySlug } from "./company.controller.js";

const companyRouter = Router();

/*
|--------------------------------------------------------------------------
| Public company profile
|--------------------------------------------------------------------------
|
| The employer workspace has been retired from the admin-managed JobsSpot
| model. Company creation, editing, jobs, applicants, members, invitations,
| and activity are now managed through /api/admin routes instead.
|
*/

// GET /api/companies/:slug
// Retrieve a public company profile using its slug.
companyRouter.get("/:slug", asyncHandler(getCompanyBySlug));

export default companyRouter;
