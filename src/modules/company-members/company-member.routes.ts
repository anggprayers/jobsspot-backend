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
    transferCompanyOwnershipController,
    updateCompanyMemberRoleController,
} from "./company-member.controller.js";

import {
    addCompanyMemberSchema,
    transferCompanyOwnershipSchema,
    updateCompanyMemberRoleSchema,
} from "./company-member.validation.js";

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

// POST /api/companies/:companyId/members/transfer-ownership
// Transfer company ownership to another active member and demote the current owner to admin.
companyMemberRouter.post(
    "/transfer-ownership",
    asyncHandler(requireAuth),
    requireCompanyRole([CompanyMemberRole.OWNER]),
    validate(transferCompanyOwnershipSchema),
    asyncHandler(transferCompanyOwnershipController),
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
