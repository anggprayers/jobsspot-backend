import { Router } from "express";

import { CompanyMemberRole } from "../../generated/prisma/client.js";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireCompanyRole } from "../../middleware/requireCompanyRole.js";

import { getCompanyActivityController } from "./audit-log.controller.js";

const auditLogRouter = Router({
    mergeParams: true,
});

// GET /api/companies/:companyId/activity
// Retrieve the company's audit trail. Restricted to owners and administrators.
auditLogRouter.get(
    "/",
    asyncHandler(requireAuth),
    requireCompanyRole([CompanyMemberRole.OWNER, CompanyMemberRole.ADMIN]),
    asyncHandler(getCompanyActivityController),
);

export default auditLogRouter;
