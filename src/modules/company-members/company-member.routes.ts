import { Router } from "express";

import { CompanyMemberRole } from "../../generated/prisma/client.js";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireCompanyRole } from "../../middleware/requireCompanyRole.js";
import { validate } from "../../middleware/validate.js";

import {
    addCompanyMemberController,
    getCompanyMembersController,
    removeCompanyMemberController,
    searchCompanyMemberCandidatesController,
    updateCompanyMemberRoleController,
} from "./company-member.controller.js";

import { addCompanyMemberSchema, updateCompanyMemberRoleSchema } from "./company-member.validation.js";

const companyMemberRouter = Router({
    mergeParams: true,
});

const managingRoles = [CompanyMemberRole.OWNER, CompanyMemberRole.ADMIN];

// GET /api/companies/:companyId/members
// Retrieve all active members of a company.
companyMemberRouter.get(
    "/",
    asyncHandler(requireAuth),
    requireCompanyRole(managingRoles),
    asyncHandler(getCompanyMembersController),
);

// GET /api/companies/:companyId/members/search-users?query=john
// Search registered JobsSpot users who are eligible to be added to the company.
companyMemberRouter.get(
    "/search-users",
    asyncHandler(requireAuth),
    requireCompanyRole(managingRoles),
    asyncHandler(searchCompanyMemberCandidatesController),
);

// POST /api/companies/:companyId/members
// Add an existing registered JobsSpot user to the company by email.
companyMemberRouter.post(
    "/",
    asyncHandler(requireAuth),
    requireCompanyRole(managingRoles),
    validate(addCompanyMemberSchema),
    asyncHandler(addCompanyMemberController),
);

// PATCH /api/companies/:companyId/members/:memberId
// Update an existing company member's role.
companyMemberRouter.patch(
    "/:memberId",
    asyncHandler(requireAuth),
    requireCompanyRole(managingRoles),
    validate(updateCompanyMemberRoleSchema),
    asyncHandler(updateCompanyMemberRoleController),
);

// DELETE /api/companies/:companyId/members/:memberId
// Soft-remove an existing member from the company.
companyMemberRouter.delete(
    "/:memberId",
    asyncHandler(requireAuth),
    requireCompanyRole(managingRoles),
    asyncHandler(removeCompanyMemberController),
);

export default companyMemberRouter;
